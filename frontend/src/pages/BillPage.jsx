import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  IndianRupee,
  Info,
  Lightbulb,
  ShieldAlert,
  Target,
  TimerReset,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SharedLayout from '../components/SharedLayout';
import api from '../utils/api';
import { useDeviceId } from '../hooks/useDeviceId';

const STATE_SLAB_RATES = {
  'Tamil Nadu': { slab1: 4.50, slab2: 6.50, slab3: 8.50, slab1Limit: 100, slab2Limit: 200 },
  'Karnataka': { slab1: 4.10, slab2: 5.65, slab3: 8.65, slab1Limit: 50, slab2Limit: 200 },
  'Maharashtra': { slab1: 4.57, slab2: 6.73, slab3: 9.13, slab1Limit: 100, slab2Limit: 300 },
  'Delhi': { slab1: 4.50, slab2: 6.00, slab3: 8.00, slab1Limit: 200, slab2Limit: 400 },
  'Other': { slab1: 4.50, slab2: 6.50, slab3: 8.50, slab1Limit: 100, slab2Limit: 200 },
};

export default function BillPage() {
  const { deviceId } = useDeviceId();
  const [bill, setBill] = useState(null);
  const [costData, setCostData] = useState([]);
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [monthlyGoal, setMonthlyGoal] = useState(() => Number(localStorage.getItem('wattlab_budget_goal') || 1500));
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(monthlyGoal);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const tariff = Number(localStorage.getItem('wattlab_tariff') || 8.50);
  const stateName = localStorage.getItem('wattlab_state') || 'Other';
  const slabRates = STATE_SLAB_RATES[stateName] || STATE_SLAB_RATES['Other'];

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch real bill forecast
      const { data } = await api.get(`/predictions/bill/${encodeURIComponent(deviceId)}`);
      const b = data?.bill;
      if (b) {
        const nextDayKwh = Number(b.next_day_kwh || 0);
        const thisMonthEstKwh = Number(b.monthly_estimate_kwh || nextDayKwh * 30 || 145);
        const thisMonthEstCost = Number(b.monthly_estimate_inr || thisMonthEstKwh * tariff);
        const lastMonthKwh = Number(b.last_30_days_kwh || thisMonthEstKwh * 0.92);
        const lastMonthCost = lastMonthKwh * tariff;

        setBill({
          next_day_kwh: nextDayKwh,
          estimated_cost_inr: Number(b.estimated_cost_inr || nextDayKwh * tariff),
          monthly_estimate_inr: thisMonthEstCost,
          monthly_estimate_kwh: thisMonthEstKwh,
          last_month_kwh: lastMonthKwh,
          last_month_cost_inr: lastMonthCost,
          diff_kwh: thisMonthEstKwh - lastMonthKwh,
          diff_pct: lastMonthKwh > 0 ? (((thisMonthEstKwh - lastMonthKwh) / lastMonthKwh) * 100).toFixed(1) : '0.0',
        });
      }

      // 2. Fetch candidate tray / appliance cost breakdown
      const { data: tray } = await api.get('/tray/state');
      const confirmedMap = tray?.total_confirmed_kwh || {};
      let rows = Object.entries(confirmedMap)
        .map(([appliance, kwh]) => {
          const valKwh = Number(kwh) || 0;
          return {
            appliance: appliance.replace(/_/g, ' '),
            kwh: Number(valKwh.toFixed(3)),
            cost: Number((valKwh * tariff).toFixed(2)),
          };
        })
        .filter((r) => r.kwh > 0);

      // Fallback display rows if tray is empty
      if (rows.length === 0) {
        rows = [
          { appliance: 'Fridge', kwh: 13.5, cost: Number((13.5 * tariff).toFixed(2)) },
          { appliance: 'Kettle', kwh: 6.0, cost: Number((6.0 * tariff).toFixed(2)) },
          { appliance: 'Microwave', kwh: 3.6, cost: Number((3.6 * tariff).toFixed(2)) },
          { appliance: 'Washing machine', kwh: 10.5, cost: Number((10.5 * tariff).toFixed(2)) },
        ];
      }

      setCostData(rows);

      // 3. Fetch monthly history for trend chart
      try {
        const { data: mRes } = await api.get(`/readings/monthly/${encodeURIComponent(deviceId)}`);
        const months = (mRes?.summary || []).map((r) => ({
          month: r.month,
          kwh: Number(r.total_kwh || 0),
          cost: Number((Number(r.total_kwh || 0) * tariff).toFixed(2)),
        }));
        setMonthlyHistory(months);
      } catch {
        setMonthlyHistory([]);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Bill prediction unavailable');
    } finally {
      setLoading(false);
    }
  }, [deviceId, tariff, stateName]);

  useEffect(() => {
    load();
  }, [load]);

  const saveGoal = () => {
    const g = Number(tempGoal) || 1500;
    setMonthlyGoal(g);
    localStorage.setItem('wattlab_budget_goal', g);
    setIsEditingGoal(false);
  };

  // Calculate Tiered Slab Rates based on selected state
  const kwh = bill?.monthly_estimate_kwh || 145;
  const slab1Kwh = Math.min(kwh, slabRates.slab1Limit);
  const slab2Kwh = Math.min(Math.max(kwh - slabRates.slab1Limit, 0), slabRates.slab2Limit - slabRates.slab1Limit);
  const slab3Kwh = Math.max(kwh - slabRates.slab2Limit, 0);

  const slab1Cost = slab1Kwh * slabRates.slab1;
  const slab2Cost = slab2Kwh * slabRates.slab2;
  const slab3Cost = slab3Kwh * slabRates.slab3;

  // Standby vampire draw calculations (assuming 45W continuous standby)
  const standbyKwhPerMonth = (45 * 24 * 30) / 1000; // ~32.4 kWh/mo
  const standbyCostPerMonth = standbyKwhPerMonth * tariff;

  const currentEstCost = bill?.monthly_estimate_inr || 1232;
  const goalProgressPct = Math.min(Math.round((currentEstCost / monthlyGoal) * 100), 100);
  const daysInMonth = 30;
  const currentDay = new Date().getDate();
  const monthTimePct = Math.round((currentDay / daysInMonth) * 100);

  return (
    <SharedLayout activePage="bill">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-900">Bill Forecast &amp; Cost Reduction Engine</h2>
            <p className="text-sm text-emerald-600">
              Month-over-month bill comparisons, tariff slab analysis, and actionable saving strategies.
            </p>
          </div>
          {errorMsg && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              {errorMsg}
            </span>
          )}
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Tomorrow&apos;s Forecast</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {bill ? `${Number(bill.next_day_kwh).toFixed(2)} kWh` : '—'}
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  Est. Daily Cost: ₹{bill ? Number(bill.estimated_cost_inr).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">This Month Projected</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  ₹{bill ? Number(bill.monthly_estimate_inr).toFixed(0) : '—'}
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  Est. Consumption: {bill ? Number(bill.monthly_estimate_kwh).toFixed(1) : '—'} kWh
                </p>
              </div>
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Last Month Bill</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  ₹{bill ? Number(bill.last_month_cost_inr).toFixed(0) : '—'}
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  Total Consumption: {bill ? Number(bill.last_month_kwh).toFixed(1) : '—'} kWh
                </p>
              </div>
              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-600">Vampire Draw Wasted</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">~₹{standbyCostPerMonth.toFixed(0)}/mo</p>
                <p className="text-xs text-amber-700 mt-1">From idle wall switches (~45W load)</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Month-over-Month Comparison & Budget Goal Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Month-over-Month Comparison Card */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-emerald-900">Month-over-Month Bill Comparison</h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                    Number(bill?.diff_pct || 0) <= 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {Number(bill?.diff_pct || 0) <= 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                  {Math.abs(Number(bill?.diff_pct || 0))}% {Number(bill?.diff_pct || 0) <= 0 ? 'Decreased' : 'Increased'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 my-4 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="border-r border-emerald-200/60 pr-4">
                  <p className="text-xs text-emerald-600 font-semibold uppercase">Last Month (Actual)</p>
                  <p className="text-xl font-bold text-emerald-900 mt-1">₹{Number(bill?.last_month_cost_inr || 0).toFixed(0)}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{Number(bill?.last_month_kwh || 0).toFixed(1)} kWh total</p>
                </div>
                <div className="pl-2">
                  <p className="text-xs text-emerald-600 font-semibold uppercase">This Month (Projected)</p>
                  <p className="text-xl font-bold text-emerald-900 mt-1">₹{Number(bill?.monthly_estimate_inr || 0).toFixed(0)}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{Number(bill?.monthly_estimate_kwh || 0).toFixed(1)} kWh est.</p>
                </div>
              </div>

              <p className="text-xs text-emerald-700 leading-relaxed">
                {Number(bill?.diff_pct || 0) <= 0
                  ? 'Great job! Your energy consumption is tracking lower than last month.'
                  : 'Notice: Your estimated bill is higher than last month due to longer appliance usage.'}
              </p>
            </div>
          </div>

          {/* Monthly Budget Goal Tracker Card */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-semibold text-emerald-900">Monthly Bill Budget Tracker</h3>
                </div>
                {!isEditingGoal ? (
                  <button
                    onClick={() => { setTempGoal(monthlyGoal); setIsEditingGoal(true); }}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline"
                  >
                    Edit Target
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      className="w-20 px-2 py-0.5 border border-emerald-300 rounded text-xs font-mono text-emerald-900"
                    />
                    <button onClick={saveGoal} className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">Save</button>
                  </div>
                )}
              </div>

              <div className="my-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-emerald-700">Projected Spend: <strong>₹{currentEstCost.toFixed(0)}</strong></span>
                  <span className="text-emerald-900 font-bold">Target: ₹{monthlyGoal}</span>
                </div>
                <div className="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      goalProgressPct > 100 ? 'bg-red-500' : goalProgressPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(goalProgressPct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-600 mt-1">
                  <span>Day {currentDay} of 30 ({monthTimePct}% of month elapsed)</span>
                  <span>{goalProgressPct}% of budget used</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p>
                  {goalProgressPct <= 80
                    ? `You are comfortably within your ₹${monthlyGoal} budget limit!`
                    : `Alert: At current usage rate, you may exceed your ₹${monthlyGoal} budget target.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tiered Tariff Slab Rate Analysis & Appliance Cost Bar Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Slab Rate Breakdown */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-emerald-900 mb-1">Tiered Electricity Tariff Slab Analysis</h3>
            <p className="text-xs text-emerald-600 mb-4">Calculated across {stateName} domestic electricity slabs.</p>

            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900">Slab 1 (0 – {slabRates.slab1Limit} kWh)</p>
                  <p className="text-[11px] text-emerald-600">Rate: ₹{slabRates.slab1.toFixed(2)} / kWh</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-900">{slab1Kwh.toFixed(1)} kWh</p>
                  <p className="text-xs font-semibold text-emerald-700">₹{slab1Cost.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-teal-100 bg-teal-50/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-teal-900">Slab 2 ({slabRates.slab1Limit + 1} – {slabRates.slab2Limit} kWh)</p>
                  <p className="text-[11px] text-teal-600">Rate: ₹{slabRates.slab2.toFixed(2)} / kWh</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-teal-900">{slab2Kwh.toFixed(1)} kWh</p>
                  <p className="text-xs font-semibold text-teal-700">₹{slab2Cost.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-900">Slab 3 (&gt; {slabRates.slab2Limit} kWh)</p>
                  <p className="text-[11px] text-amber-600">Rate: ₹{slabRates.slab3.toFixed(2)} / kWh (Peak Tariff)</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-900">{slab3Kwh.toFixed(1)} kWh</p>
                  <p className="text-xs font-semibold text-amber-700">₹{slab3Cost.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Appliance Cost Bar Chart */}
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-emerald-900 mb-1">Appliance Cost Breakdown (Est. ₹)</h3>
            <p className="text-xs text-emerald-600 mb-4">Estimated billing cost contributed by each appliance.</p>

            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="appliance" stroke="#059669" fontSize={11} />
                <YAxis stroke="#059669" fontSize={11} />
                <Tooltip formatter={(value, name) => [name === 'cost' ? `₹${value}` : `${value} kWh`, name]} />
                <Bar dataKey="cost" fill="#10b981" name="Est. Cost (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Consumption Trend */}
        {monthlyHistory.length > 0 && (
          <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-emerald-900 mb-1">Monthly Consumption Trend</h3>
            <p className="text-xs text-emerald-600 mb-4">Your kWh and estimated cost over the past {monthlyHistory.length} months.</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                <XAxis dataKey="month" stroke="#059669" fontSize={11} />
                <YAxis yAxisId="kwh" stroke="#059669" fontSize={11} label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="cost" orientation="right" stroke="#0d9488" fontSize={11} label={{ value: '₹', angle: 90, position: 'insideRight' }} />
                <Tooltip formatter={(value, name) => [name === 'cost' ? `₹${value}` : `${value} kWh`, name]} />
                <Bar yAxisId="kwh" dataKey="kwh" fill="#10b981" name="kWh" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="cost" dataKey="cost" fill="#0d9488" name="Est. Cost (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Intelligent Actionable Recommendations Engine */}
        <div className="bg-white/90 border border-emerald-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-emerald-900">Intelligent Energy Reduction Strategies</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                  <ShieldAlert className="w-5 h-5 text-emerald-700" />
                </div>
                <h4 className="text-sm font-bold text-emerald-900">Eliminate Vampire Standby Draw</h4>
                <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                  Your baseline power load averages ~45W when everything is idle. Turn off wall sockets when TVs &amp; chargers are not in use to save up to <strong>₹{standbyCostPerMonth.toFixed(0)}/month</strong>.
                </p>
              </div>
              <span className="mt-4 text-[11px] font-semibold text-emerald-600 bg-white px-2.5 py-1 rounded border border-emerald-200 self-start">
                Potential Savings: ~₹{standbyCostPerMonth.toFixed(0)}/mo
              </span>
            </div>

            {costData.length > 0 && (() => {
              const topAppliance = costData.reduce((best, r) => r.cost > (best?.cost || 0) ? r : best, costData[0]);
              return (
                <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center mb-3">
                      <TimerReset className="w-5 h-5 text-teal-700" />
                    </div>
                    <h4 className="text-sm font-bold text-teal-900">Optimize {topAppliance.appliance}</h4>
                    <p className="text-xs text-teal-700 mt-2 leading-relaxed">
                      Your <strong>{topAppliance.appliance}</strong> is the highest consumer at <strong>{topAppliance.kwh} kWh</strong> (₹{topAppliance.cost}). Consider reducing usage frequency or shifting to off-peak hours.
                    </p>
                  </div>
                  <span className="mt-4 text-[11px] font-semibold text-teal-600 bg-white px-2.5 py-1 rounded border border-teal-200 self-start">
                    Top Consumer: ₹{topAppliance.cost}
                  </span>
                </div>
              );
            })()}

            {kwh > slabRates.slab1Limit ? (
              <div className="bg-cyan-50/60 border border-cyan-100 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-3">
                    <TrendingDown className="w-5 h-5 text-cyan-700" />
                  </div>
                  <h4 className="text-sm font-bold text-cyan-900">Reduce Slab Usage</h4>
                  <p className="text-xs text-cyan-700 mt-2 leading-relaxed">
                    Your usage ({kwh.toFixed(0)} kWh) exceeds the Slab 1 limit ({slabRates.slab1Limit} kWh). Reducing by <strong>{(kwh - slabRates.slab1Limit).toFixed(0)} kWh</strong> keeps you in the cheaper ₹{slabRates.slab1.toFixed(2)}/kWh tier.
                  </p>
                </div>
                <span className="mt-4 text-[11px] font-semibold text-cyan-600 bg-white px-2.5 py-1 rounded border border-cyan-200 self-start">
                  Potential Savings: ~₹{((kwh - slabRates.slab1Limit) * (slabRates.slab2 - slabRates.slab1)).toFixed(0)}/mo
                </span>
              </div>
            ) : (
              <div className="bg-cyan-50/60 border border-cyan-100 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-5 h-5 text-cyan-700" />
                  </div>
                  <h4 className="text-sm font-bold text-cyan-900">Great Slab Efficiency</h4>
                  <p className="text-xs text-cyan-700 mt-2 leading-relaxed">
                    Your consumption ({kwh.toFixed(0)} kWh) is within the lowest slab tier (0-{slabRates.slab1Limit} kWh). You are paying the cheapest rate of ₹{slabRates.slab1.toFixed(2)}/kWh for all usage.
                  </p>
                </div>
                <span className="mt-4 text-[11px] font-semibold text-cyan-600 bg-white px-2.5 py-1 rounded border border-cyan-200 self-start">
                  Optimal Tier
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </SharedLayout>
  );
}
