/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment and subscription updates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db as prisma } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const productType = session.metadata?.productType; // 'chat_queries', 'scenario_runs', 'subscription'
  const quantity = parseInt(session.metadata?.quantity || '0');

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Create purchase record
  await prisma.purchase.create({
    data: {
      userId,
      stripePaymentId: session.payment_intent as string,
      stripeCheckoutId: session.id,
      productType: productType || 'unknown',
      amount: session.amount_total || 0,
      currency: session.currency || 'usd',
      quantity,
      status: 'completed',
      fulfilledAt: new Date(),
      metadata: {
        mode: session.mode,
        customerEmail: session.customer_email,
      },
    },
  });

  // Fulfill the purchase based on product type
  if (productType === 'chat_queries') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        purchasedChatQueries: { increment: quantity },
      },
    });
  } else if (productType === 'scenario_runs') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        purchasedScenarioRuns: { increment: quantity },
      },
    });
  } else if (productType === 'subscription') {
    // Handle subscription separately in handleSubscriptionUpdate
    console.log('Subscription will be handled by subscription webhook');
  }

  console.log(`Purchase fulfilled for user ${userId}: ${quantity}x ${productType}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Determine tier from subscription metadata or price lookup
  const tier = subscription.metadata?.tier || 'pro'; // Default to 'pro'

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      subscriptionTier: tier,
      subscriptionStatus: subscription.status,
      subscriptionStartedAt: new Date(subscription.current_period_start * 1000),
      subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription updated for user ${userId}: ${tier} (${subscription.status})`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: 'freemium',
      subscriptionStatus: 'canceled',
      subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription canceled for user ${userId}`);
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  // Update purchase status if needed
  const purchase = await prisma.purchase.findUnique({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (purchase && purchase.status === 'pending') {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: 'completed',
        fulfilledAt: new Date(),
      },
    });
  }

  console.log(`Payment succeeded: ${paymentIntent.id}`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  // Update purchase status
  const purchase = await prisma.purchase.findUnique({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (purchase) {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        status: 'failed',
      },
    });
  }

  console.error(`Payment failed: ${paymentIntent.id}`);
}
