// lib/integrations/providers.ts
import { Provider } from '@/types/integration';

export const PROVIDER_CONFIG: Provider[] = [
  // ============================================================================
  // FINANCIAL PROVIDERS (16 total)
  // ============================================================================

  // Plaid - CONNECTED
  {
    id: 'plaid',
    name: 'Plaid',
    description: 'Securely connect your bank accounts and financial institutions',
    category: 'finance',
    logo: '/images/integrations/plaid.png',
    connected: true, // Plaid is connected
    comingSoon: false,
    permissions: [
      'View your financial account information',
      'View your transactions and balances',
      'View your investment holdings and returns'
    ],
    modalDescription: 'Plaid lets you securely connect your financial accounts to Life Navigator. We use bank-level encryption and never store your credentials.'
  },

  // Personal Finance Tools
  {
    id: 'monarch',
    name: 'Monarch Money',
    description: 'Modern money management and budgeting with collaborative features',
    category: 'finance',
    logo: '/images/integrations/monarch.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your net worth tracking',
      'View your custom budgets',
      'Access collaborative finance features'
    ],
    modalDescription: 'Monarch Money is a modern personal finance platform with powerful budgeting tools and collaborative features for couples and families.'
  },
  {
    id: 'ynab',
    name: 'YNAB',
    description: 'Zero-based budgeting system to give every dollar a job',
    category: 'finance',
    logo: '/images/integrations/ynab.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your budget categories and allocations',
      'View your transaction history',
      'Read-only access to your budget goals'
    ],
    modalDescription: 'You Need A Budget (YNAB) helps you take control of your money with zero-based budgeting, where every dollar has a purpose.'
  },
  {
    id: 'personal-capital',
    name: 'Personal Capital',
    description: 'Wealth management and investment tracking for retirement planning',
    category: 'finance',
    logo: '/images/integrations/personal-capital.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View portfolio analysis',
      'Access retirement planning tools',
      'View investment checkup reports'
    ],
    modalDescription: 'Personal Capital combines wealth management with powerful investment tracking and retirement planning tools.'
  },
  {
    id: 'quicken',
    name: 'Quicken',
    description: 'Desktop personal finance software with comprehensive money management',
    category: 'finance',
    logo: '/images/integrations/quicken.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View bill management',
      'View investment tracking',
      'Access tax planning features'
    ],
    modalDescription: 'Quicken is a comprehensive personal finance platform for managing your bills, investments, and tax planning.'
  },

  // Investment Platforms
  {
    id: 'robinhood',
    name: 'Robinhood',
    description: 'Commission-free stock trading with cryptocurrency support',
    category: 'finance',
    logo: '/images/integrations/robinhood.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your stock holdings',
      'View cryptocurrency balances',
      'Access fractional shares data'
    ],
    modalDescription: 'Robinhood offers commission-free stock and cryptocurrency trading with support for fractional shares.'
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Leading cryptocurrency exchange for buying, selling, and storing crypto',
    category: 'finance',
    logo: '/images/integrations/coinbase.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your cryptocurrency balances',
      'View your transaction history',
      'Access wallet information and staking rewards'
    ],
    modalDescription: 'Coinbase is a leading cryptocurrency platform with secure wallet storage, staking rewards, and insurance protection.'
  },
  {
    id: 'wealthfront',
    name: 'Wealthfront',
    description: 'Automated investing and financial planning with tax optimization',
    category: 'finance',
    logo: '/images/integrations/wealthfront.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View automated investment portfolios',
      'Access tax-loss harvesting data',
      'View financial planning recommendations'
    ],
    modalDescription: 'Wealthfront provides automated investing with sophisticated tax-loss harvesting and comprehensive financial planning tools.'
  },
  {
    id: 'betterment',
    name: 'Betterment',
    description: 'Robo-advisor for investing with personalized portfolio recommendations',
    category: 'finance',
    logo: '/images/integrations/betterment.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View goal-based investing portfolios',
      'Access auto-rebalancing data',
      'View tax coordination features'
    ],
    modalDescription: 'Betterment is a robo-advisor that creates personalized portfolios based on your goals with automatic rebalancing and tax optimization.'
  },

  // Payment Platforms
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and financial infrastructure for businesses',
    category: 'finance',
    logo: '/images/integrations/stripe.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View payment processing data',
      'Access subscription billing information',
      'View financial reporting'
    ],
    modalDescription: 'Stripe provides payment processing and financial infrastructure for businesses with advanced fraud detection and reporting.'
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Digital wallet and payment platform for online transactions',
    category: 'finance',
    logo: '/images/integrations/paypal.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View digital wallet balance',
      'Access transaction history',
      'View invoices and international payments'
    ],
    modalDescription: 'PayPal is a trusted digital payment platform with buyer protection and international payment capabilities.'
  },
  {
    id: 'venmo',
    name: 'Venmo',
    description: 'Peer-to-peer payment app with social features',
    category: 'finance',
    logo: '/images/integrations/venmo.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View P2P payment history',
      'Access social feed data',
      'View bill splitting transactions'
    ],
    modalDescription: 'Venmo makes it easy to send and receive money with friends and family, with fun social features and bill splitting.'
  },
  {
    id: 'cashapp',
    name: 'Cash App',
    description: 'Mobile payment service with investing and banking features',
    category: 'finance',
    logo: '/images/integrations/cashapp.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View mobile payment history',
      'Access Bitcoin trading data',
      'View direct deposit information'
    ],
    modalDescription: 'Cash App combines mobile payments with Bitcoin trading and direct deposit banking features.'
  },

  // Business Finance
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Business accounting software for invoicing, expenses, and payroll',
    category: 'finance',
    logo: '/images/integrations/quickbooks.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View invoicing data',
      'Access expense tracking',
      'View payroll management'
    ],
    modalDescription: 'QuickBooks is a comprehensive business accounting platform for managing invoices, expenses, and payroll.'
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Invoicing and accounting software for small businesses and freelancers',
    category: 'finance',
    logo: '/images/integrations/freshbooks.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View professional invoicing',
      'Access time tracking data',
      'View expense management'
    ],
    modalDescription: 'FreshBooks is designed for small businesses and freelancers with professional invoicing and time tracking features.'
  },
  {
    id: 'wave',
    name: 'Wave',
    description: 'Free accounting software with invoicing and receipt scanning',
    category: 'finance',
    logo: '/images/integrations/wave.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View accounting data',
      'Access receipt scanning',
      'View invoice creation'
    ],
    modalDescription: 'Wave provides free accounting software with professional invoicing and receipt scanning capabilities.'
  },

  // ============================================================================
  // EDUCATION PROVIDERS (6 total)
  // ============================================================================

  {
    id: 'icarus',
    name: 'Icarus.AI',
    description: 'AI-powered adaptive learning platform with personalized skill development',
    category: 'education',
    logo: '/images/integrations/icarus.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your learning progress',
      'Access AI tutor sessions',
      'View skill assessments and recommendations'
    ],
    modalDescription: 'Icarus.AI uses artificial intelligence to create personalized learning paths and provide adaptive tutoring tailored to your learning style.'
  },
  {
    id: 'udemy',
    name: 'Udemy',
    description: 'Online learning marketplace with 200,000+ courses',
    category: 'education',
    logo: '/images/integrations/udemy.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your enrolled courses',
      'Access course progress and completion',
      'View certificates earned'
    ],
    modalDescription: 'Udemy is a global learning marketplace offering courses in business, technology, design, and personal development.'
  },
  {
    id: 'coursera',
    name: 'Coursera',
    description: 'University-level courses and professional certificates',
    category: 'education',
    logo: '/images/integrations/coursera.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your enrolled courses and specializations',
      'Access course progress and grades',
      'View professional certificates and degrees'
    ],
    modalDescription: 'Coursera partners with top universities and companies to offer world-class online courses, specializations, and degrees.'
  },
  {
    id: 'edx',
    name: 'edX',
    description: 'MIT and Harvard founded online learning platform',
    category: 'education',
    logo: '/images/integrations/edx.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your course enrollments',
      'Access MicroMasters and Professional Certificates',
      'View verified certificates'
    ],
    modalDescription: 'edX offers high-quality courses from the world\'s best universities and institutions, including MIT, Harvard, and Berkeley.'
  },
  {
    id: 'cfi',
    name: 'Corporate Finance Institute',
    description: 'Professional finance and banking certification programs',
    category: 'education',
    logo: '/images/integrations/cfi.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View certification progress',
      'Access financial modeling courses',
      'View professional certificates'
    ],
    modalDescription: 'CFI provides world-class financial analyst training and certifications recognized by leading financial institutions globally.'
  },
  {
    id: 'linkedin_learning',
    name: 'LinkedIn Learning',
    description: 'Professional development courses taught by industry experts',
    category: 'education',
    logo: '/images/integrations/linkedin-learning.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your learning history',
      'Access course recommendations',
      'View certificates and learning paths'
    ],
    modalDescription: 'LinkedIn Learning offers thousands of courses in business, technology, and creative skills taught by industry experts.'
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Connect your educational courses and assignments',
    category: 'education',
    logo: '/images/integrations/canvas.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your courses and assignments',
      'View your grades and progress',
      'Access your academic calendar'
    ],
    modalDescription: 'Canvas is a leading learning management system used by schools and universities worldwide.'
  },
  {
    id: 'google_classroom',
    name: 'Google Classroom',
    description: 'Connect your Google Classroom courses',
    category: 'education',
    logo: '/images/integrations/google_classroom.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your enrolled courses',
      'View your assignments and due dates',
      'Access your class materials'
    ],
    modalDescription: 'Google Classroom streamlines assignments, boosts collaboration, and fosters communication in educational settings.'
  },

  // ============================================================================
  // HEALTHCARE PROVIDERS (16 total)
  // ============================================================================

  // Fitness Trackers
  {
    id: 'fitbit',
    name: 'Fitbit',
    description: 'Activity tracking, heart rate monitoring, and sleep analysis',
    category: 'healthcare',
    logo: '/images/integrations/fitbit.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View activity and step data',
      'Access heart rate and sleep tracking',
      'View exercise logs and calorie data'
    ],
    modalDescription: 'Fitbit provides comprehensive fitness tracking with activity monitoring, heart rate analysis, and sleep insights.'
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    description: 'Centralized health data from iPhone and Apple Watch',
    category: 'healthcare',
    logo: '/images/integrations/apple-health.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View health data from HealthKit',
      'Access activity and workout data',
      'View vital signs and medical records'
    ],
    modalDescription: 'Apple Health aggregates health and fitness data from your iPhone, Apple Watch, and compatible third-party apps.'
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    description: 'Activity tracking and health insights for Android',
    category: 'healthcare',
    logo: '/images/integrations/google-fit.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View activity data and move minutes',
      'Access heart points and workouts',
      'View health metrics and trends'
    ],
    modalDescription: 'Google Fit tracks your movement and health data, providing insights to help you live a healthier, more active life.'
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Advanced fitness tracking and training metrics',
    category: 'healthcare',
    logo: '/images/integrations/garmin.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View advanced activity tracking',
      'Access training metrics and VO2 max',
      'View stress and recovery data'
    ],
    modalDescription: 'Garmin provides professional-grade fitness tracking with advanced metrics for serious athletes and fitness enthusiasts.'
  },
  {
    id: 'whoop',
    name: 'Whoop',
    description: 'Recovery, strain, and sleep performance tracking',
    category: 'healthcare',
    logo: '/images/integrations/whoop.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View recovery scores',
      'Access strain and sleep data',
      'View HRV and respiratory rate'
    ],
    modalDescription: 'Whoop focuses on recovery optimization with detailed strain, sleep, and recovery metrics for peak performance.'
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Sleep tracking, readiness scores, and activity monitoring',
    category: 'healthcare',
    logo: '/images/integrations/oura.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View sleep scores and stages',
      'Access readiness and activity data',
      'View body temperature trends'
    ],
    modalDescription: 'Oura Ring provides detailed sleep tracking and readiness scores to optimize your health and performance.'
  },

  // Health & Wellness Apps
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    description: 'Calorie counting and nutrition tracking',
    category: 'healthcare',
    logo: '/images/integrations/myfitnesspal.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View calorie and macro tracking',
      'Access food diary and nutrition data',
      'View weight and progress tracking'
    ],
    modalDescription: 'MyFitnessPal is the world\'s largest food database for tracking calories, macros, and achieving your nutrition goals.'
  },
  {
    id: 'strava',
    name: 'Strava',
    description: 'Social fitness network for runners and cyclists',
    category: 'healthcare',
    logo: '/images/integrations/strava.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View activities and workouts',
      'Access performance metrics',
      'View social fitness data and segments'
    ],
    modalDescription: 'Strava is a social network for athletes, tracking runs and rides with detailed performance analytics and community features.'
  },
  {
    id: 'peloton',
    name: 'Peloton',
    description: 'Connected fitness with live and on-demand classes',
    category: 'healthcare',
    logo: '/images/integrations/peloton.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View workout history',
      'Access performance metrics',
      'View class schedules and achievements'
    ],
    modalDescription: 'Peloton offers connected fitness experiences with world-class instructors and comprehensive workout tracking.'
  },
  {
    id: 'headspace',
    name: 'Headspace',
    description: 'Meditation and mindfulness for mental wellness',
    category: 'healthcare',
    logo: '/images/integrations/headspace.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View meditation session history',
      'Access mindfulness progress',
      'View sleep and focus exercises'
    ],
    modalDescription: 'Headspace provides guided meditation and mindfulness exercises to reduce stress and improve mental wellness.'
  },

  // Medical Records & Healthcare
  {
    id: 'epic_mychart',
    name: 'Epic MyChart',
    description: 'Access medical records, appointments, and lab results',
    category: 'healthcare',
    logo: '/images/integrations/epic.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your medical history',
      'View your upcoming appointments',
      'Access your lab results and medications'
    ],
    modalDescription: 'Epic MyChart provides secure access to your health information from participating healthcare providers. HIPAA compliant.'
  },
  {
    id: 'cerner',
    name: 'Cerner',
    description: 'Electronic health records and patient portal',
    category: 'healthcare',
    logo: '/images/integrations/cerner.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View electronic health records',
      'Access appointment scheduling',
      'View prescriptions and test results'
    ],
    modalDescription: 'Cerner\'s patient portal provides access to your health records, appointments, and communication with healthcare providers.'
  },
  {
    id: 'teladoc',
    name: 'Teladoc',
    description: 'Virtual healthcare and telehealth consultations',
    category: 'healthcare',
    logo: '/images/integrations/teladoc.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View telehealth visit history',
      'Access virtual consultation records',
      'View prescriptions and treatment plans'
    ],
    modalDescription: 'Teladoc connects you with board-certified doctors via phone, video, or app for convenient virtual healthcare.'
  },
  {
    id: 'labcorp',
    name: 'LabCorp',
    description: 'Lab test results and diagnostic services',
    category: 'healthcare',
    logo: '/images/integrations/labcorp.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View lab test results',
      'Access diagnostic reports',
      'View appointment history'
    ],
    modalDescription: 'LabCorp provides access to your lab test results and diagnostic services with secure, HIPAA-compliant access.'
  },

  // Nutrition
  {
    id: 'cronometer',
    name: 'Cronometer',
    description: 'Detailed nutrition tracking with micronutrient analysis',
    category: 'healthcare',
    logo: '/images/integrations/cronometer.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View nutrition tracking data',
      'Access micronutrient analysis',
      'View dietary goals and progress'
    ],
    modalDescription: 'Cronometer provides detailed nutrition tracking with comprehensive micronutrient analysis for optimal health.'
  },
  {
    id: 'noom',
    name: 'Noom',
    description: 'Psychology-based weight loss and health coaching',
    category: 'healthcare',
    logo: '/images/integrations/noom.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View weight loss progress',
      'Access food logging data',
      'View coaching interactions'
    ],
    modalDescription: 'Noom combines psychology, technology, and human coaching to help you build healthier habits and achieve sustainable weight loss.'
  },

  // ============================================================================
  // CAREER PROVIDERS (15 total)
  // ============================================================================

  // Professional Networking
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional networking, job search, and career development',
    category: 'career',
    logo: '/images/integrations/linkedin.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your profile information',
      'View your connections and network',
      'Access your job history and skills',
      'View job recommendations and applications'
    ],
    modalDescription: 'LinkedIn is the world\'s largest professional network with 900+ million members. Connect with professionals, discover job opportunities, and build your career.'
  },
  {
    id: 'twitter',
    name: 'Twitter (X)',
    description: 'Professional social networking and industry insights',
    category: 'career',
    logo: '/images/integrations/twitter.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your profile and tweets',
      'Access your followers and following',
      'View professional conversations and trends'
    ],
    modalDescription: 'Twitter (X) is a powerful platform for professional networking, thought leadership, and staying updated on industry trends and news.'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    description: 'Visual portfolio and personal brand building',
    category: 'career',
    logo: '/images/integrations/instagram.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your profile and posts',
      'Access your followers and engagement',
      'View professional content and stories'
    ],
    modalDescription: 'Instagram is ideal for visual professionals, creatives, and entrepreneurs to showcase their work and build their personal brand.'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Short-form video content for career branding',
    category: 'career',
    logo: '/images/integrations/tiktok.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View your profile and videos',
      'Access your followers and engagement',
      'View professional content performance'
    ],
    modalDescription: 'TikTok is increasingly used for career content, industry insights, and professional brand building through engaging short-form videos.'
  },

  // Job Search & Career Opportunities
  {
    id: 'indeed',
    name: 'Indeed',
    description: 'Job search and career opportunities',
    category: 'career',
    logo: '/images/integrations/indeed.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View job search history',
      'Access saved jobs and applications',
      'View application status and tracking'
    ],
    modalDescription: 'Indeed is the world\'s #1 job site with millions of jobs from thousands of company websites and job boards.'
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    description: 'Company reviews, salaries, and interview insights',
    category: 'career',
    logo: '/images/integrations/glassdoor.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View company reviews and ratings',
      'Access salary data and comparisons',
      'View interview questions and insights'
    ],
    modalDescription: 'Glassdoor provides transparency into companies with employee reviews, salary data, and interview experiences to help you make informed career decisions.'
  },
  {
    id: 'upwork',
    name: 'Upwork',
    description: 'Freelance marketplace for professional services',
    category: 'career',
    logo: '/images/integrations/upwork.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View freelance job proposals',
      'Access project history and earnings',
      'View client reviews and ratings'
    ],
    modalDescription: 'Upwork connects freelancers with clients worldwide, offering opportunities in development, design, writing, marketing, and more.'
  },
  {
    id: 'fiverr',
    name: 'Fiverr',
    description: 'Freelance services marketplace',
    category: 'career',
    logo: '/images/integrations/fiverr.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View gig performance and orders',
      'Access earnings and reviews',
      'View buyer requests and opportunities'
    ],
    modalDescription: 'Fiverr is a global marketplace for freelance services, where you can offer your skills or find talented professionals for your projects.'
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    description: 'Global freelancing and crowdsourcing marketplace',
    category: 'career',
    logo: '/images/integrations/freelancer.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View project bids and proposals',
      'Access earnings and milestones',
      'View contest entries and rankings'
    ],
    modalDescription: 'Freelancer.com is one of the world\'s largest freelancing and crowdsourcing marketplaces with millions of projects across hundreds of categories.'
  },

  // Events & Networking
  {
    id: 'eventbrite',
    name: 'Eventbrite',
    description: 'Professional events, conferences, and networking',
    category: 'career',
    logo: '/images/integrations/eventbrite.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View registered events',
      'Access event recommendations',
      'View professional networking opportunities'
    ],
    modalDescription: 'Eventbrite helps you discover and attend professional conferences, workshops, seminars, and networking events in your industry and location.'
  },
  {
    id: 'meetup',
    name: 'Meetup',
    description: 'Local professional groups and networking events',
    category: 'career',
    logo: '/images/integrations/meetup.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View joined groups and RSVPs',
      'Access event history and attendance',
      'View local networking opportunities'
    ],
    modalDescription: 'Meetup connects you with local professional groups, industry meetups, and skill-building events in your area for networking and career growth.'
  },
  {
    id: 'chamber_commerce',
    name: 'Chamber of Commerce',
    description: 'Local business networking and community events',
    category: 'career',
    logo: '/images/integrations/chamber.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View local chamber events',
      'Access business networking opportunities',
      'View member directory and connections'
    ],
    modalDescription: 'Connect with your local Chamber of Commerce to discover business networking events, community gatherings, and professional development opportunities.'
  },

  // Professional Development
  {
    id: 'github',
    name: 'GitHub',
    description: 'Developer portfolio and open source contributions',
    category: 'career',
    logo: '/images/integrations/github.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View repositories and contributions',
      'Access commit history and activity',
      'View starred projects and followers'
    ],
    modalDescription: 'GitHub showcases your development work, open source contributions, and technical skills to potential employers and collaborators.'
  },
  {
    id: 'behance',
    name: 'Behance',
    description: 'Creative portfolio and design showcase',
    category: 'career',
    logo: '/images/integrations/behance.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View portfolio projects',
      'Access project views and appreciations',
      'View followers and creative network'
    ],
    modalDescription: 'Behance is Adobe\'s platform for showcasing and discovering creative work, perfect for designers, artists, and creative professionals.'
  },
  {
    id: 'angellist',
    name: 'AngelList',
    description: 'Startup jobs and venture funding opportunities',
    category: 'career',
    logo: '/images/integrations/angellist.png',
    connected: false,
    comingSoon: true,
    permissions: [
      'View startup job opportunities',
      'Access company profiles and culture',
      'View equity and compensation data'
    ],
    modalDescription: 'AngelList (now Wellfound) connects job seekers with startup opportunities, offering transparency into equity, culture, and funding stages.'
  },

  // ============================================================================
  // AUTOMOTIVE PROVIDERS (12 total: 5 ready + 7 coming soon)
  // ============================================================================

  // Ready to Use (Public APIs)
  {
    id: 'smartcar',
    name: 'Smartcar',
    description: 'Universal vehicle connectivity - supports 30+ car brands',
    category: 'automotive',
    logo: '/images/integrations/smartcar.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View vehicle information and VIN',
      'View real-time location',
      'Access fuel/charge level and range',
      'View odometer and mileage',
      'Remote lock/unlock (if supported)',
      'Access maintenance status'
    ],
    modalDescription: 'Smartcar is a universal vehicle API that connects to 30+ car brands including GM, Ford, BMW, Mercedes, Audi, Honda, Toyota, Nissan, and more through a single integration. Get real-time vehicle data, location tracking, and remote control capabilities.'
  },
  {
    id: 'tesla',
    name: 'Tesla',
    description: 'Tesla electric vehicle integration with charging insights',
    category: 'automotive',
    logo: '/images/integrations/tesla.png',
    connected: false,
    comingSoon: false, // READY - Community API
    permissions: [
      'View vehicle status and location',
      'Access battery charge level',
      'View charging history and statistics',
      'Remote climate control',
      'Lock/unlock and start/stop charging',
      'View driving efficiency metrics'
    ],
    modalDescription: 'Direct integration with Tesla vehicles for comprehensive EV monitoring including charging data, battery health, driving statistics, and remote vehicle control.'
  },
  {
    id: 'gasbuddy',
    name: 'GasBuddy',
    description: 'Find cheapest gas prices and track fuel expenses',
    category: 'automotive',
    logo: '/images/integrations/gasbuddy.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View local gas prices',
      'Access price history and trends',
      'Find nearby gas stations',
      'Track fuel purchases and expenses'
    ],
    modalDescription: 'GasBuddy helps you find the cheapest gas prices near you and track your fuel expenses over time with detailed analytics.'
  },
  {
    id: 'manual_vehicle',
    name: 'Manual Entry',
    description: 'Manually track vehicle maintenance, expenses, and trips',
    category: 'automotive',
    logo: '/images/integrations/manual.png',
    connected: false,
    comingSoon: false, // READY - Built-in feature
    permissions: [
      'Add vehicles manually',
      'Track maintenance records',
      'Log fuel purchases and expenses',
      'Record trip details',
      'Set service reminders'
    ],
    modalDescription: 'Manually track all your vehicle data including maintenance records, fuel expenses, insurance, and service reminders - perfect for any vehicle regardless of connectivity.'
  },
  {
    id: 'gps_trip_tracking',
    name: 'GPS Trip Tracking',
    description: 'Automatic trip logging using your phone GPS',
    category: 'automotive',
    logo: '/images/integrations/gps.png',
    connected: false,
    comingSoon: false, // READY - Uses phone GPS
    permissions: [
      'Access device location',
      'Track trips automatically',
      'Calculate mileage for business/personal',
      'Generate mileage reports',
      'View trip history and routes'
    ],
    modalDescription: 'Automatically track your trips using your phone\'s GPS. Perfect for mileage tracking, business expense reports, and understanding your driving patterns.'
  },

  // Coming Soon (Require Partnerships)
  {
    id: 'carfax',
    name: 'CARFAX',
    description: 'Vehicle history reports and maintenance tracking',
    category: 'automotive',
    logo: '/images/integrations/carfax.png',
    connected: false,
    comingSoon: true, // Partnership required
    permissions: [
      'View vehicle history reports',
      'Access maintenance records',
      'View service reminders',
      'Check accident history'
    ],
    modalDescription: 'CARFAX integration coming soon! Get comprehensive vehicle history reports, maintenance records, and automated service reminders.'
  },
  {
    id: 'onstar',
    name: 'OnStar',
    description: 'GM vehicle connectivity and emergency services',
    category: 'automotive',
    logo: '/images/integrations/onstar.png',
    connected: false,
    comingSoon: true, // No public API
    permissions: [
      'View vehicle diagnostics',
      'Remote start and control',
      'Access emergency assistance',
      'View vehicle health reports'
    ],
    modalDescription: 'OnStar integration coming soon! Connect your GM vehicle for remote control, diagnostics, and emergency services.'
  },
  {
    id: 'fordpass',
    name: 'FordPass',
    description: 'Ford vehicle management and FordPass Rewards',
    category: 'automotive',
    logo: '/images/integrations/fordpass.png',
    connected: false,
    comingSoon: true, // Limited developer program
    permissions: [
      'View vehicle status',
      'Remote start and lock',
      'Access vehicle health alerts',
      'Track FordPass Rewards points'
    ],
    modalDescription: 'FordPass integration coming soon! Manage your Ford vehicle, earn rewards, and access exclusive Ford owner benefits.'
  },
  {
    id: 'mybmw',
    name: 'MyBMW',
    description: 'BMW ConnectedDrive services and vehicle control',
    category: 'automotive',
    logo: '/images/integrations/mybmw.png',
    connected: false,
    comingSoon: true, // No public API
    permissions: [
      'View vehicle status',
      'Remote services and control',
      'Access ConnectedDrive features',
      'View service history'
    ],
    modalDescription: 'MyBMW integration coming soon! Connect your BMW for remote services, vehicle status, and ConnectedDrive features.'
  },
  {
    id: 'mercedesme',
    name: 'Mercedes Me',
    description: 'Mercedes-Benz connected vehicle services',
    category: 'automotive',
    logo: '/images/integrations/mercedes.png',
    connected: false,
    comingSoon: true, // Partner API only
    permissions: [
      'View vehicle information',
      'Remote vehicle control',
      'Access service and maintenance data',
      'View digital vehicle documents'
    ],
    modalDescription: 'Mercedes Me integration coming soon! Access your Mercedes-Benz vehicle data, remote services, and maintenance information.'
  },
  {
    id: 'audiconnect',
    name: 'Audi Connect',
    description: 'Audi vehicle services and myAudi features',
    category: 'automotive',
    logo: '/images/integrations/audi.png',
    connected: false,
    comingSoon: true, // No public API
    permissions: [
      'View vehicle status',
      'Remote lock and climate control',
      'Access myAudi services',
      'View service intervals'
    ],
    modalDescription: 'Audi Connect integration coming soon! Connect your Audi for vehicle status, remote control, and myAudi services.'
  },
  {
    id: 'aaa',
    name: 'AAA',
    description: 'Roadside assistance and membership benefits',
    category: 'automotive',
    logo: '/images/integrations/aaa.png',
    connected: false,
    comingSoon: true, // Partner API
    permissions: [
      'View membership status',
      'Request roadside assistance',
      'Access member discounts',
      'View service call history'
    ],
    modalDescription: 'AAA integration coming soon! Quick access to roadside assistance, membership benefits, and service history.'
  },

  // ============================================================================
  // SMART HOME PROVIDERS (15 total: 9 ready + 6 coming soon)
  // ============================================================================

  // Ready to Use (Public APIs)
  {
    id: 'google_home',
    name: 'Google Home',
    description: 'Google smart home ecosystem with voice control',
    category: 'smarthome',
    logo: '/images/integrations/google_home.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View your device list',
      'Control smart home devices',
      'View device status and history',
      'Access routines and automations',
      'Manage rooms and zones'
    ],
    modalDescription: 'Google Home integration with the Google Smart Home API lets you control and monitor all your Google-connected devices from Life Navigator.'
  },
  {
    id: 'alexa',
    name: 'Amazon Alexa',
    description: 'Amazon smart home with voice assistant integration',
    category: 'smarthome',
    logo: '/images/integrations/alexa.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View connected devices',
      'Control smart home devices',
      'Access routines and automations',
      'View voice command history',
      'Manage device groups'
    ],
    modalDescription: 'Amazon Alexa Smart Home Skill API provides full control of your Alexa-connected devices, routines, and automations through Life Navigator.'
  },
  {
    id: 'smartthings',
    name: 'Samsung SmartThings',
    description: 'Universal smart home hub supporting 200+ brands',
    category: 'smarthome',
    logo: '/images/integrations/smartthings.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View all connected devices',
      'Control devices and scenes',
      'Access automations and rules',
      'View energy monitoring',
      'Manage locations and rooms'
    ],
    modalDescription: 'SmartThings acts as a universal hub, connecting devices from 200+ brands. One integration for comprehensive smart home control.'
  },
  {
    id: 'philips_hue',
    name: 'Philips Hue',
    description: 'Smart lighting system with color and ambiance control',
    category: 'smarthome',
    logo: '/images/integrations/hue.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View and control lights',
      'Create and manage scenes',
      'Schedule lighting automations',
      'Access energy usage data',
      'Manage rooms and zones'
    ],
    modalDescription: 'Philips Hue API provides full control of your smart lighting including color changes, brightness, scenes, and scheduling.'
  },
  {
    id: 'ecobee',
    name: 'Ecobee',
    description: 'Smart thermostat with energy savings insights',
    category: 'smarthome',
    logo: '/images/integrations/ecobee.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View temperature and climate data',
      'Control thermostat settings',
      'Access energy reports',
      'Manage schedules and comfort settings',
      'View sensor data'
    ],
    modalDescription: 'Ecobee API integration for smart climate control, energy monitoring, and automated temperature scheduling.'
  },
  {
    id: 'august',
    name: 'August',
    description: 'Smart locks and home access control',
    category: 'smarthome',
    logo: '/images/integrations/august.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View lock status',
      'Lock and unlock remotely',
      'View access history',
      'Manage guest access',
      'Receive security notifications'
    ],
    modalDescription: 'August Smart Lock API provides remote lock control, access history tracking, and guest access management.'
  },
  {
    id: 'sonos',
    name: 'Sonos',
    description: 'Multi-room wireless sound system',
    category: 'smarthome',
    logo: '/images/integrations/sonos.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View and control speakers',
      'Manage playback and volume',
      'Create and manage groups',
      'Access favorites and playlists',
      'View system information'
    ],
    modalDescription: 'Sonos Control API for managing multi-room audio, playback control, and speaker grouping across your home.'
  },
  {
    id: 'tplink_kasa',
    name: 'TP-Link Kasa',
    description: 'Smart plugs, switches, and lighting',
    category: 'smarthome',
    logo: '/images/integrations/kasa.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'View and control devices',
      'Monitor energy usage',
      'Create schedules and timers',
      'Set up scenes and automations',
      'Access device statistics'
    ],
    modalDescription: 'TP-Link Kasa API provides control of smart plugs, switches, and bulbs with energy monitoring capabilities.'
  },
  {
    id: 'ifttt',
    name: 'IFTTT',
    description: 'Automation platform connecting 700+ services',
    category: 'smarthome',
    logo: '/images/integrations/ifttt.png',
    connected: false,
    comingSoon: false, // READY - Public API
    permissions: [
      'Create and manage applets',
      'Connect multiple services',
      'Set up custom automations',
      'Access webhook integrations',
      'View automation history'
    ],
    modalDescription: 'IFTTT (If This Then That) connects 700+ services and devices, enabling powerful cross-platform automations for your smart home.'
  },

  // Coming Soon (Require Partnerships or Certifications)
  {
    id: 'homekit',
    name: 'Apple HomeKit',
    description: 'Secure smart home control for Apple devices',
    category: 'smarthome',
    logo: '/images/integrations/homekit.png',
    connected: false,
    comingSoon: true, // MFi certification required
    permissions: [
      'View HomeKit accessories',
      'Control devices via Siri',
      'Access scenes and automations',
      'View home status',
      'Manage HomeKit secure video'
    ],
    modalDescription: 'Apple HomeKit integration coming soon! Secure, private control of your smart home accessories through your Apple devices.'
  },
  {
    id: 'nest',
    name: 'Google Nest',
    description: 'Smart thermostats, cameras, and doorbells',
    category: 'smarthome',
    logo: '/images/integrations/nest.png',
    connected: false,
    comingSoon: true, // Device Access API (limited)
    permissions: [
      'View thermostat settings',
      'Control temperature and schedules',
      'Access camera feeds',
      'View home/away status',
      'Receive security alerts'
    ],
    modalDescription: 'Google Nest integration coming soon! Intelligent climate control, home security cameras, and energy management.'
  },
  {
    id: 'ring',
    name: 'Ring',
    description: 'Video doorbells and home security cameras',
    category: 'smarthome',
    logo: '/images/integrations/ring.png',
    connected: false,
    comingSoon: true, // Partnership required
    permissions: [
      'View camera live feeds',
      'Access recorded videos',
      'Receive motion alerts',
      'Control doorbell features',
      'Manage device settings'
    ],
    modalDescription: 'Ring integration coming soon! Access your video doorbells, security cameras, and motion alerts.'
  },
  {
    id: 'arlo',
    name: 'Arlo',
    description: 'Wireless security camera system',
    category: 'smarthome',
    logo: '/images/integrations/arlo.png',
    connected: false,
    comingSoon: true, // Partner API
    permissions: [
      'View camera streams',
      'Access recorded footage',
      'Receive motion notifications',
      'Control camera modes',
      'Manage storage and plans'
    ],
    modalDescription: 'Arlo integration coming soon! Monitor your wireless security cameras and access recorded footage.'
  },
  {
    id: 'lutron',
    name: 'Lutron',
    description: 'Advanced lighting and shade control systems',
    category: 'smarthome',
    logo: '/images/integrations/lutron.png',
    connected: false,
    comingSoon: true, // Partner API
    permissions: [
      'Control lighting and dimmers',
      'Manage motorized shades',
      'Create and run scenes',
      'Set up schedules',
      'Access system status'
    ],
    modalDescription: 'Lutron integration coming soon! Professional-grade lighting and shade control for your smart home.'
  },
  {
    id: 'wyze',
    name: 'Wyze',
    description: 'Affordable smart home cameras and devices',
    category: 'smarthome',
    logo: '/images/integrations/wyze.png',
    connected: false,
    comingSoon: true, // No official API
    permissions: [
      'View camera feeds',
      'Access recorded clips',
      'Control smart devices',
      'Receive notifications',
      'Manage device settings'
    ],
    modalDescription: 'Wyze integration coming soon! Access your affordable smart cameras, sensors, and home devices.'
  }
];