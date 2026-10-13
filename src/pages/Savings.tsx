import SavingsGoals from '@/components/SavingsGoals';
import SavingsChart from '@/components/SavingsChart';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';

const Savings = () => {
  const { goals, deposits } = useSavingsGoals();

  return (
    <div className="animate-fade-in p-4 md:p-6 lg:p-8 space-y-6">
      <SavingsGoals />
      <SavingsChart deposits={deposits} goals={goals} />
    </div>
  );
};

export default Savings;
