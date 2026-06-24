import { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Lightbulb, TimerReset, TrendingDown, Zap } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';

const mockBill = {
  next_day_kwh: 3.2,
  estimated_cost_inr: 27.2,
  monthly_estimate_inr: 816,
  monthly_estimate_kwh: 96,
};

const costData = [
  { appliance: 'Fridge', kwh: 28.3, cost: 240 },
  { appliance: 'AC', kwh: 45.5, cost: 387 },
  { appliance: 'Water Heater', kwh: 32.1, cost: 273 },
  { appliance: 'Washing Machine', kwh: 23.6, cost: 201 },
  { appliance: 'Other', kwh: 15.0, cost: 128 },
];

const tips = [
  {
    icon: TimerReset,
    title: 'Run washing machine off-peak',
    text: 'Run washing machine at off-peak hours (10pm-6am) to save up to Rs 50/month.',
  },
  {
    icon: Lightbulb,
    title: 'Keep fridge efficiency high',
    text: 'Your fridge is running efficiently. Keep it away from heat sources.',
  },
  {
    icon: TrendingDown,
    title: 'Tune cooling load',
    text: 'AC accounts for 35% of your bill. Set to 24C to save Rs 120/month.',
  },
];

export default function BillPage() {
  const [bill, setBill] = useState(mockBill);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = useCallback(async () => {
    try {
      const deviceId = localStorage.getItem('wattlab_device_id') || 'SIM-DEVICE-001';
      const { data } = await api.get(`/predictions/bill/${encodeURIComponent(deviceId)}`);
      const nextDay = Number(data?.bill?.next_day_kwh || mockBill.next_day_kwh);
      setBill({
        next_day_kwh: nextDay,
        estimated_cost_inr: Number(data?.bill?.estimated_cost_inr || mockBill.estimated_cost_inr),
        monthly_estimate_inr: Number(data?.bill?.monthly_estimate_inr || nextDay * 30 * 8.5),
        monthly_estimate_kwh: Number(data?.bill?.monthly_estimate_kwh || nextDay * 30),
      });
      setUsingFallback(false);
    } catch {
      setBill(mockBill);
      setUsingFallback(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    { label: "Tomorrow's forecast", value: `${Number(bill.next_day_kwh).toFixed(2)} kWh`, icon: Zap },
    { label: "Tomorrow's cost", value: `Rs ${Number(bill.estimated_cost_inr).toFixed(2)}`, icon: IndianRupee },
    { label: 'Monthly estimate', value: `Rs ${Number(bill.monthly_estimate_inr).toFixed(0)}`, icon: TrendingDown },
    { label: 'Monthly kWh', value: `${Number(bill.monthly_estimate_kwh).toFixed(1)} kWh`, icon: Zap },
  ];

  return (
    <SharedLayout activePage="bill">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">Bill Forecast</h2>
            <p className="text-sm text-emerald-600">Estimate upcoming usage and monthly cost</p>
          </div>
          {usingFallback && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Showing sample forecast
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600">{card.label}</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{card.value}</p>
                  </div>
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-900 mb-4">Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
              <XAxis dataKey="appliance" stroke="#059669" />
              <YAxis stroke="#059669" />
              <Tooltip formatter={(value, name) => [name === 'cost' ? `Rs ${value}` : `${value} kWh`, name]} />
              <Bar dataKey="cost" fill="#10b981" name="Monthly cost" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <div key={tip.title} className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
                <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-900">{tip.title}</h3>
                <p className="text-sm text-emerald-700 mt-2">{tip.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </SharedLayout>
  );
}
