import { AzureFunction, Context } from "@azure/functions"
import { AzureScheduledJobs } from "../../src/lib/database/azure-config"

/**
 * Azure Function for Data Retention
 * Replaces pg_cron for automated data purging
 * Runs daily at 2 AM UTC
 */
const dataRetentionTimer: AzureFunction = async function (
  context: Context, 
  myTimer: any
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  context.log('Data Retention Function started at:', timestamp);
  
  try {
    // Run data retention job
    await AzureScheduledJobs.runDataRetention();
    
    context.log('Data Retention completed successfully');
    
    // Log to Application Insights
    context.log.metric('DataRetention.Success', 1, {
      timestamp,
      duration: Date.now() - new Date(timestamp).getTime()
    });
    
  } catch (error) {
    context.log.error('Data Retention failed:', error);
    
    // Log failure to Application Insights
    context.log.metric('DataRetention.Failure', 1, {
      timestamp,
      error: (error as Error).message
    });
    
    // Re-throw to mark function as failed
    throw error;
  }
  
  if (myTimer.isPastDue) {
    context.log('Timer is past due!');
  }
};

export default dataRetentionTimer;