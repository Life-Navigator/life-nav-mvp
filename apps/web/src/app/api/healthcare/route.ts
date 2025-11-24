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
      }).catch(() => []),
      // Health records (appointments, prescriptions, etc.)
      prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 100,
      }).catch(() => []),
    ]);

    // Medications - not currently implemented in schema
    const medications: any[] = [];

    // Process health score history from actual metrics
    const healthScoreHistory = generateHealthScoreHistory(healthMetrics);

    // Get latest vital signs from actual data
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

    // Generate activity data from actual health metrics
    const activityData = generateActivityDataFromMetrics(healthMetrics);

    // Generate sleep data from actual health metrics
    const sleepData = generateSleepDataFromMetrics(healthMetrics);

    // Get upcoming appointments from health records
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

    // Calculate medication adherence from actual data
    const medicationAdherence = calculateMedicationAdherence(medications || []);

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

// Helper functions - all based on actual data, no mock generation

function generateHealthScoreHistory(metrics: any[]) {
  if (!metrics || metrics.length === 0) {
    return [];
  }

  const result: { date: string; score: number }[] = [];
  const metricsByDate = new Map<string, any>();

  // Group metrics by date
  metrics.forEach(m => {
    const dateKey = m.date.toISOString().split('T')[0];
    if (!metricsByDate.has(dateKey)) {
      metricsByDate.set(dateKey, m);
    }
  });

  // Calculate scores for dates with actual data
  metricsByDate.forEach((metric, dateKey) => {
    let factors = 0;
    let totalScore = 0;

    if (metric.heartRate && metric.heartRate >= 60 && metric.heartRate <= 100) {
      totalScore += 80;
      factors++;
    } else if (metric.heartRate) {
      totalScore += 60;
      factors++;
    }

    if (metric.systolicBP && metric.systolicBP >= 110 && metric.systolicBP <= 130) {
      totalScore += 80;
      factors++;
    } else if (metric.systolicBP) {
      totalScore += 60;
      factors++;
    }

    if (metric.steps && metric.steps >= 8000) {
      totalScore += 85;
      factors++;
    } else if (metric.steps && metric.steps >= 5000) {
      totalScore += 70;
      factors++;
    } else if (metric.steps) {
      totalScore += 50;
      factors++;
    }

    const score = factors > 0 ? Math.round(totalScore / factors) : 0;

    result.push({
      date: dateKey,
      score,
    });
  });

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

function generateActivityDataFromMetrics(metrics: any[]) {
  if (!metrics || metrics.length === 0) {
    return [];
  }

  const result: { day: string; steps: number; activeMinutes: number }[] = [];
  const last7Days = metrics.slice(0, 7).reverse();

  last7Days.forEach(metric => {
    const date = new Date(metric.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

    result.push({
      day: dayName,
      steps: metric.steps || 0,
      activeMinutes: metric.activeMinutes || 0,
    });
  });

  return result;
}

function generateSleepDataFromMetrics(metrics: any[]) {
  if (!metrics || metrics.length === 0) {
    return [];
  }

  const result: { day: string; hours: number; quality: number }[] = [];
  const last7Days = metrics.slice(0, 7).reverse();

  last7Days.forEach(metric => {
    const date = new Date(metric.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

    result.push({
      day: dayName,
      hours: metric.sleepHours || 0,
      quality: metric.sleepQuality || 0,
    });
  });

  return result;
}

function calculateMedicationAdherence(medications: any[]) {
  if (!medications || medications.length === 0) {
    return { adherence: 0, medications: [] };
  }

  const medicationList = medications.map(med => ({
    name: med.name || 'Unknown',
    adherence: med.adherenceRate || 0,
  }));

  const totalAdherence = medicationList.reduce((sum, med) => sum + med.adherence, 0);
  const averageAdherence = medicationList.length > 0
    ? Math.round(totalAdherence / medicationList.length)
    : 0;

  return {
    adherence: averageAdherence,
    medications: medicationList,
  };
}
