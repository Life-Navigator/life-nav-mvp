import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Demo mode - return empty data structure without database queries
    if (userId === 'demo-user-id') {
      const healthcareData = {
        healthScoreHistory: [],
        vitalSigns: {
          bloodPressure: { systolic: 0, diastolic: 0, date: new Date().toISOString() },
          heartRate: { value: 0, date: new Date().toISOString() },
          weight: { value: 0, date: new Date().toISOString() },
        },
        activityData: [],
        sleepData: [],
        upcomingAppointments: [],
        medicationAdherence: { adherence: 0, medications: [] },
      };
      return NextResponse.json(healthcareData);
    }

    // Fetch health data in parallel
    const [
      healthMetrics,
      healthRecords,
    ] = await Promise.all([
      // Health metrics (last 30 days)
      prisma.healthMetric.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: 'desc' },
      }),
      // Health records (appointments, prescriptions, etc.)
      prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 100,
      }),
    ]);

    // Process health score history
    const healthScoreHistory = generateHealthScoreHistory(healthMetrics);

    // Get latest vital signs
    const latestVitals = healthMetrics.length > 0 ? healthMetrics[0] : null;
    const vitalSigns = {
      bloodPressure: {
        systolic: latestVitals?.systolicBP || 0,
        diastolic: latestVitals?.diastolicBP || 0,
        date: latestVitals?.date.toISOString() || new Date().toISOString(),
      },
      heartRate: {
        value: latestVitals?.heartRate || 0,
        date: latestVitals?.date.toISOString() || new Date().toISOString(),
      },
      weight: {
        value: latestVitals?.weight || 0,
        date: latestVitals?.date.toISOString() || new Date().toISOString(),
      },
    };

    // Generate activity and sleep data (would need dedicated tables)
    const activityData = generateMockActivityData();
    const sleepData = generateMockSleepData();

    // Get upcoming appointments
    const upcomingAppointments = healthRecords
      .filter(record =>
        record.type === 'medical_visit' &&
        record.date >= new Date()
      )
      .slice(0, 5)
      .map(record => ({
        id: record.id,
        doctor: record.providerName || 'Unknown Provider',
        specialty: record.category || 'General',
        date: record.date.toISOString().split('T')[0],
        time: record.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }));

    // Medication adherence (would need dedicated Medication table)
    const medicationAdherence = {
      adherence: 85,
      medications: [
        { name: 'Vitamin D', adherence: 95 },
        { name: 'Multivitamin', adherence: 75 },
      ],
    };

    return NextResponse.json({
      healthScoreHistory: healthScoreHistory || [],
      vitalSigns: vitalSigns || {
        bloodPressure: { systolic: 0, diastolic: 0, date: new Date().toISOString() },
        heartRate: { value: 0, date: new Date().toISOString() },
        weight: { value: 0, date: new Date().toISOString() },
      },
      activityData: activityData || [],
      sleepData: sleepData || [],
      upcomingAppointments: upcomingAppointments || [],
      medicationAdherence: medicationAdherence || { adherence: 0, medications: [] },
    });
  } catch (error) {
    console.error('Error fetching healthcare data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch healthcare data' },
      { status: 500 }
    );
  }
}

// Helper functions
function generateHealthScoreHistory(metrics: any[]) {
  const result = [];
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    // Try to find actual metrics for this date
    const metricForDate = metrics.find(m =>
      m.date.toISOString().split('T')[0] === dateKey
    );

    // Calculate score from available metrics or use baseline
    let score = 75;
    if (metricForDate) {
      // Simple scoring based on available metrics
      let factors = 0;
      let totalScore = 0;

      if (metricForDate.heartRate && metricForDate.heartRate >= 60 && metricForDate.heartRate <= 100) {
        totalScore += 80;
        factors++;
      }
      if (metricForDate.systolicBP && metricForDate.systolicBP >= 110 && metricForDate.systolicBP <= 130) {
        totalScore += 80;
        factors++;
      }
      if (metricForDate.steps && metricForDate.steps >= 8000) {
        totalScore += 85;
        factors++;
      }

      if (factors > 0) {
        score = Math.round(totalScore / factors);
      }
    }

    result.push({
      date: dateKey,
      score,
    });
  }

  return result;
}

function generateMockActivityData() {
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const isWeekend = [0, 6].includes(date.getDay());

    result.push({
      day: dayName,
      steps: Math.round((isWeekend ? 9000 : 7000) + Math.random() * 2000 - 1000),
      activeMinutes: Math.round((isWeekend ? 45 : 30) + Math.random() * 20 - 10),
    });
  }

  return result;
}

function generateMockSleepData() {
  const result = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const isWeekend = [0, 6].includes(date.getDay());

    const baseSleep = isWeekend ? 8 : 7;
    const sleepVariation = Math.random() * 1.5 - 0.75;

    result.push({
      day: dayName,
      hours: Math.round((baseSleep + sleepVariation) * 10) / 10,
      quality: Math.round(Math.random() * 30 + 60),
    });
  }

  return result;
}
