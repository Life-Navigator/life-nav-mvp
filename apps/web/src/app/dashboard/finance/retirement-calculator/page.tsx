import RetirementCalculator from '@/components/financial/retirement/RetirementCalculator';

export const metadata = {
  title: 'Retirement Calculator | LifeNavigator',
  description: 'Plan your retirement with our advanced calculator that helps you project savings, contributions, and income replacement.',
};

export default function RetirementCalculatorPage() {
  return (
    <div className="container mx-auto py-8">
      <RetirementCalculator />
    </div>
  );
}