import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ENV } from '../../../config/env.config';
import { useAuth } from '../../../context/AuthContext';
import {
  ChevronLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar as CalendarIcon,
  Crown,
  CreditCard,
  Ban,
  Activity,
  X,
  AlertTriangle,
  ClipboardList,
  Repeat,
  Package,
  Star,
  Truck,
  Sparkles
} from 'lucide-react';
import {
  format,
  parseISO,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  isAfter,
  startOfToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { toast } from 'sonner';

// --- Interfaces ---
interface Subscription {
  subscriptionId: string;
  plan: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  paymentMethod: string;
  paymentStatus: string;
  skippedDates?: string[];
  remainingDays?: number;
  deliveryDays?: string[];
  deliveryFee?: number;
  isRecurring?: boolean;
  totalAmount?: number;
  subtotal?: number;
  couponCode?: string | null;
  firstDeliveryDate?: string | null;
  notes?: string | null;
}

interface ActivityLog {
  activityId: string;
  type: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface Notification {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

interface UserDetail {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  area: string;
  role: string;
  picture: string | null;
  lastLoginAt: string | null;
  subscription: Subscription | null;
  customization: any | null;
  activities: ActivityLog[];
  notifications: Notification[];
}

const AdminUserDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const fetchUserDetail = async () => {
      try {
        const token = await user?.getIdToken();
        const response = await axios.get(`${ENV.API_URL}/admin/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserDetail(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch user details');
      } finally {
        setLoading(false);
      }
    };

    if (user && userId) {
      fetchUserDetail();
    }
  }, [user, userId]);

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim() || !userDetail?.subscription?.subscriptionId) return;
    
    setIsCancelling(true);
    try {
      const token = await user?.getIdToken();
      await axios.post(
        `${ENV.API_URL}/admin/users/${userId}/cancel-subscription`,
        {
          subscriptionId: userDetail.subscription.subscriptionId,
          reason: cancelReason.trim()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Update local state to reflect cancellation
      setUserDetail(prev => {
        if (!prev || !prev.subscription) return prev;
        return {
          ...prev,
          subscription: {
            ...prev.subscription,
            status: 'Cancelled'
          }
        };
      });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  const subscription = userDetail?.subscription;
  const customization = userDetail?.customization;
  const activities = userDetail?.activities || [];

  // --- Customization Logic ---
  const customSpecs = useMemo(() => {
    if (!subscription) return null;
    const details = (subscription as any).planDetails || {};
    const customObj = (subscription as any).customDetails || {};
    const selections = details.selections || customObj.selections || (subscription as any).selectedComponents || {};
    const planName = (subscription.plan || '').toLowerCase();
    const isCustom = Boolean(
      details.custom || details.isCustomPlan || customObj.isCustomPlan ||
      planName.includes('custom') || planName.includes('scratch') ||
      details.roti !== undefined || selections.roti !== undefined || customObj.roti !== undefined ||
      (subscription as any).selectedComponents?.roti !== undefined
    );

    const rawSabji = details.sabji ?? details.sabziChoices ?? selections.sabji ?? selections.sabziChoices ?? customObj.sabji ?? customObj.sabziChoices ?? (subscription as any).selectedComponents?.sabji;
    const sabzi = rawSabji !== undefined && !isNaN(Number(rawSabji)) ? Number(rawSabji) : (planName.includes('basic') ? 1 : 2);

    const rawRoti = details.roti ?? selections.roti ?? customObj.roti ?? (subscription as any).selectedComponents?.roti;
    const roti = rawRoti !== undefined && !isNaN(Number(rawRoti)) ? Number(rawRoti) : (planName.includes('basic') ? 4 : 8);

    const rawRice = details.rice ?? selections.rice ?? customObj.rice ?? (subscription as any).selectedComponents?.rice;
    const rice = rawRice !== undefined && !isNaN(Number(rawRice)) ? Number(rawRice) : 0;

    const rawDal = details.dal ?? selections.dal ?? customObj.dal ?? (subscription as any).selectedComponents?.dal;
    const dal = rawDal !== undefined && !isNaN(Number(rawDal)) ? Number(rawDal) : 0;

    const raita = details.raitaFrequency || selections.raitaFrequency || customObj.raitaFrequency || details.raitaOption || (planName.includes('premium') ? 'daily' : 'threePerWeek');
    const salad = details.saladFrequency || selections.saladFrequency || customObj.saladFrequency || details.saladOption || (planName.includes('premium') ? 'daily' : 'none');
    const sweet = details.sweetDishFrequency || selections.sweetDishFrequency || customObj.sweetDishFrequency || details.dessertOption || (planName.includes('premium') ? 'twicePerWeek' : 'none');
    const satSpecial = Boolean(details.saturdaySpecial ?? selections.saturdaySpecial ?? customObj.saturdaySpecial ?? planName.includes('premium'));

    return { isCustom, sabzi, roti, rice, dal, raita, salad, sweet, satSpecial };
  }, [subscription]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Loading user profile...</p>
      </div>
    );
  }

  if (error || !userDetail) {
    return (
      <div className="p-10 text-center text-red-500">
        <AlertTriangle className="mx-auto mb-4" size={48} />
        <p className="text-lg font-bold">{error || 'User not found'}</p>
        <button onClick={() => navigate('/admin/users')} className="mt-4 text-primary hover:underline">
          Back to Users
        </button>
      </div>
    );
  }

  // --- Calendar Logic ---
  const renderCalendar = () => {
    if (!subscription || !subscription.startDate || !subscription.endDate) return null;

    const startDate = parseISO(subscription.startDate);
    const endDate = parseISO(subscription.endDate);
    const today = startOfToday();
    const skippedDates = subscription.skippedDates?.map(d => parseISO(d)) || [];

    const displayMonth = isAfter(today, endDate) ? endDate : (isBefore(today, startDate) ? startDate : today);
    
    const monthStart = startOfMonth(displayMonth);
    const monthEnd = endOfMonth(displayMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mt-8 overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
        
        <div className="p-8 pb-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-orange-400 text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Subscription Calendar</h3>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{format(displayMonth, 'MMMM yyyy')}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
             <div className="px-3 py-1.5 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 border border-gray-100 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div> Delivered
             </div>
             <div className="px-3 py-1.5 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 border border-gray-100 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]"></div> Upcoming
             </div>
             <div className="px-3 py-1.5 rounded-xl bg-gray-50 text-xs font-bold text-gray-500 border border-gray-100 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div> Skipped
             </div>
          </div>
        </div>
        
        <div className="p-8 relative z-10">
            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-4 text-center text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-2 md:gap-4">
              {days.map((day, i) => {
                const isOutsideMonth = isBefore(day, monthStart) || isAfter(day, monthEnd);
                const isBeforeStart = isBefore(day, startDate);
                const isAfterEnd = isAfter(day, endDate);
                const isSkipped = skippedDates.some(skipped => isSameDay(skipped, day));
                const isPastOrToday = isBefore(day, today) || isSameDay(day, today);
                const isToday = isSameDay(day, today);
                
                let baseStyle = 'bg-white border-gray-100 text-gray-900 hover:border-gray-300';
                let dotStyle = null;
                
                if (isOutsideMonth) {
                  baseStyle = 'bg-transparent border-transparent text-gray-300 opacity-50';
                } else if (isBeforeStart || isAfterEnd) {
                   baseStyle = 'bg-gray-50/50 border-gray-100/50 text-gray-300';
                } else if (subscription.status === 'Cancelled' && isAfter(day, endDate)) {
                   baseStyle = 'bg-red-50/50 border-red-100 text-red-300';
                } else if (isSkipped) {
                  baseStyle = 'bg-amber-50 border-amber-200 text-amber-700';
                  dotStyle = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]';
                } else if (isPastOrToday) {
                  baseStyle = 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
                  dotStyle = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]';
                } else {
                  baseStyle = 'bg-blue-50 border-blue-200 text-blue-700';
                  dotStyle = 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]';
                }
    
                if (isToday) {
                  baseStyle += ' ring-4 ring-primary/20 ring-offset-2 border-primary';
                }
    
                return (
                  <div 
                    key={i} 
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl md:rounded-3xl text-sm md:text-base font-medium border-2 transition-all duration-300 group cursor-default ${baseStyle}`}
                    title={format(day, 'MMM dd, yyyy')}
                  >
                    <span className="relative z-10">{format(day, 'd')}</span>
                    {dotStyle && (
                        <div className={`absolute bottom-2 md:bottom-3 w-1.5 h-1.5 rounded-full ${dotStyle}`}></div>
                    )}
                    {isToday && (
                        <div className="absolute top-1 right-1 md:top-2 md:right-2 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    )}
                  </div>
                );
              })}
            </div>
        </div>
      </div>
    );
  };

  const renderCustomizations = () => {
    const isCustom0Sabji = customSpecs?.isCustom && customSpecs.sabzi === 0;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLabels: Record<string, string> = {
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday'
    };
    const deliveryDays: string[] = (subscription as any)?.deliveryDays || days;
    const scheduledDaysCount = days.filter(d => deliveryDays.some(sc => sc.toLowerCase() === d.toLowerCase())).length;

    return (
      <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 pb-5 border-b border-gray-100 bg-gradient-to-r from-gray-50/70 via-white to-gray-50/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-100 text-primary flex items-center justify-center font-black shadow-xs">
                <ClipboardList size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Weekly Meal Customizations</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-700">
                    Kitchen Blueprint
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">
                  Day-by-day chef preparation guide, selected entrées, and packaging rules
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs">
                <Truck size={13} className="text-emerald-600" /> {scheduledDaysCount} Delivery Days / Week
              </span>
              {customSpecs?.isCustom && (
                <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={13} className="text-purple-600" /> Custom Plan Package
                </span>
              )}
              {isCustom0Sabji && (
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-black shadow-2xs">
                  🍲 0 Sabji Plan
                </span>
              )}
            </div>
          </div>

          {/* Quick Package Blueprint Strip */}
          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold text-gray-700 scrollbar-none">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-black shrink-0">Standard Package Blueprint:</span>
            <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shrink-0 shadow-2xs">
              🫓 {customSpecs?.roti ?? 8} Tawa Roti
            </span>
            <span className={`px-2.5 py-1 rounded-lg border shrink-0 shadow-2xs ${isCustom0Sabji ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-white border-gray-200'}`}>
              🍲 {isCustom0Sabji ? 'No Sabji (0 Sabji)' : `${customSpecs?.sabzi ?? 2} Sabji`}
            </span>
            {customSpecs?.dal && customSpecs.dal > 0 ? (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shrink-0 shadow-2xs">
                🥣 {customSpecs.dal} Dal Portion{customSpecs.dal > 1 ? 's' : ''}
              </span>
            ) : null}
            {customSpecs?.rice && customSpecs.rice > 0 ? (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 shrink-0 shadow-2xs">
                🍚 {customSpecs.rice} Rice Bowl{customSpecs.rice > 1 ? 's' : ''}
              </span>
            ) : null}
            {customSpecs?.raita && customSpecs.raita !== 'none' && (
              <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg shrink-0">
                🥣 Raita: {customSpecs.raita === 'daily' ? 'Daily' : 'Mon, Wed, Fri'}
              </span>
            )}
            {customSpecs?.salad && customSpecs.salad !== 'none' && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                🥗 Salad: {customSpecs.salad === 'daily' ? 'Daily' : 'Mon, Wed, Fri'}
              </span>
            )}
            {customSpecs?.sweet && customSpecs.sweet !== 'none' && (
              <span className="bg-pink-50 text-pink-800 border border-pink-200 px-2.5 py-1 rounded-lg shrink-0">
                🍮 Sweet: {customSpecs.sweet === 'daily' ? 'Daily' : 'Wed & Sat'}
              </span>
            )}
            {customSpecs?.satSpecial && (
              <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                ⭐ Saturday Special
              </span>
            )}
          </div>
        </div>

        {/* 6 Day Cards Grid */}
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {days.map(day => {
              const isScheduledDay = deliveryDays.some(d => d.toLowerCase() === day.toLowerCase());
              const prefs = customization?.preferences?.[day] || {};
              const isThreeDay = ['monday', 'wednesday', 'friday'].includes(day);
              const isSatSpecial = day === 'saturday' && customSpecs?.satSpecial;
              const hasRaita = customSpecs?.raita === 'daily' || (['threePerWeek', '3days'].includes(customSpecs?.raita || '') && isThreeDay);
              const hasSalad = customSpecs?.salad === 'daily' || (['threePerWeek', '3days'].includes(customSpecs?.salad || '') && isThreeDay);
              const hasSweet = customSpecs?.sweet === 'daily' || (['twicePerWeek', 'weekly'].includes(customSpecs?.sweet || '') && (day === 'wednesday' || day === 'saturday'));

              if (!isScheduledDay) {
                return (
                  <div key={day} className="bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 p-5 flex flex-col justify-between opacity-60">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2 text-gray-400">
                        <CalendarIcon size={16} />
                        <span className="font-black text-sm uppercase tracking-wider">{dayLabels[day]}</span>
                      </div>
                      <span className="text-[10px] font-black text-red-500 bg-red-50 border border-red-200/60 px-2.5 py-0.5 rounded-full uppercase">
                        ❌ Not Scheduled
                      </span>
                    </div>
                    <div className="py-10 text-center">
                      <span className="text-3xl block mb-2 opacity-50">🚫</span>
                      <p className="text-xs font-bold text-gray-500">No Delivery on {dayLabels[day]}</p>
                      <p className="text-[11px] text-gray-400 mt-1">The customer opted out of deliveries on this weekday.</p>
                    </div>
                    <div className="text-[10px] text-gray-400 text-center border-t border-gray-100 pt-2">
                      Skipped from daily morning route
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={day} 
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md ${
                    isSatSpecial ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    {/* Card Day Header */}
                    <div className={`p-4 border-b flex justify-between items-center ${
                      isSatSpecial 
                        ? 'bg-amber-50/70 border-amber-100' 
                        : 'bg-gray-50/70 border-gray-100'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                          isSatSpecial ? 'bg-amber-200/80 text-amber-950' : 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                        }`}>
                          {day.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-gray-900 leading-tight">{dayLabels[day]}</h4>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {isSatSpecial ? 'Special Menu Rotation' : 'Standard Delivery'}
                          </span>
                        </div>
                      </div>

                      {isSatSpecial ? (
                        <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1 uppercase">
                          <Star size={11} fill="currentColor" /> Saturday Special
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Scheduled
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3.5">
                      {/* 1. Main Dish Section (Curries / Sabzis / Specials) */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {isSatSpecial ? 'Chef Specials' : 'Cooked Sabji Entrées'}
                        </p>

                        {isSatSpecial ? (
                          <div className="space-y-2">
                            <div className="bg-yellow-50/90 p-3 rounded-xl border border-yellow-200">
                              <span className="text-[10px] font-black uppercase text-yellow-800 block mb-0.5">⭐ Special Food Entrée</span>
                              <p className="text-sm font-black text-yellow-950">{prefs.specialFood || "Chef's Weekend Special"}</p>
                            </div>
                            <div className="bg-pink-50/90 p-3 rounded-xl border border-pink-200">
                              <span className="text-[10px] font-black uppercase text-pink-800 block mb-0.5">🍮 Fresh Dessert</span>
                              <p className="text-sm font-black text-pink-950">{prefs.dessert || "Festive Sweet Dish"}</p>
                            </div>
                          </div>
                        ) : isCustom0Sabji ? (
                          <div className="bg-amber-50/70 border border-dashed border-amber-200 rounded-xl p-3.5 text-center">
                            <span className="text-lg block mb-0.5">🍲</span>
                            <p className="text-xs font-black text-amber-900 uppercase tracking-wider">No Sabji Included</p>
                            <p className="text-[11px] font-medium text-amber-700 mt-0.5">Customer's package does not include daily sabzi.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(customSpecs?.sabzi === null || customSpecs?.sabzi === undefined || customSpecs.sabzi >= 1) && (
                              <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/80 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md shrink-0">
                                  Sabzi 1
                                </span>
                                <span className="text-xs font-black text-blue-950 truncate text-right">
                                  {prefs.sabzi1 || "Chef's Daily Selection"}
                                </span>
                              </div>
                            )}

                            {(customSpecs?.sabzi === null || customSpecs?.sabzi === undefined || customSpecs.sabzi >= 2) && (
                              <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                                  Sabzi 2
                                </span>
                                <span className="text-xs font-black text-emerald-950 truncate text-right">
                                  {prefs.sabzi2 || "Chef's Daily Selection"}
                                </span>
                              </div>
                            )}

                            {customSpecs?.sabzi && customSpecs.sabzi >= 3 && (
                              <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200/80 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md shrink-0">
                                  Sabzi 3
                                </span>
                                <span className="text-xs font-black text-purple-950 truncate text-right">
                                  {prefs.sabzi3 || "Extra Sabzi Selection"}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Staples Section (Roti, Dal, Rice) */}
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Bread & Grain Staples</p>
                        <div className="flex flex-wrap gap-2 text-xs font-black text-gray-800">
                          <span className="bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                            <span>🫓</span>
                            <span>{customSpecs?.roti ?? 8} Tawa Roti</span>
                          </span>

                          {customSpecs?.dal && customSpecs.dal > 0 ? (
                            <span className="bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                              <span>🥣</span>
                              <span>{customSpecs.dal} Dal Portion{customSpecs.dal > 1 ? 's' : ''}</span>
                            </span>
                          ) : null}

                          {customSpecs?.rice && customSpecs.rice > 0 ? (
                            <span className="bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                              <span>🍚</span>
                              <span>{customSpecs.rice} Rice Bowl{customSpecs.rice > 1 ? 's' : ''}</span>
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* 3. Sides & Extras Section */}
                      {(hasRaita || hasSalad || hasSweet || prefs.sideOption) && (
                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Sides & Accompaniments</p>
                          <div className="flex flex-wrap gap-2 text-xs font-black">
                            {hasRaita && (
                              <span className="bg-teal-50 border border-teal-200 text-teal-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
                                <span>🥣</span>
                                <span>Raita ({customSpecs?.raita === 'daily' ? 'Daily' : 'Mon, Wed, Fri'})</span>
                              </span>
                            )}
                            {hasSalad && (
                              <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
                                <span>🥗</span>
                                <span>Garden Salad ({customSpecs?.salad === 'daily' ? 'Daily' : 'Mon, Wed, Fri'})</span>
                              </span>
                            )}
                            {prefs.sideOption && !hasRaita && !hasSalad && (
                              <span className="bg-orange-50 border border-orange-200 text-orange-900 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
                                <span>{prefs.sideOption === 'Salad' ? '🥗' : '🥣'}</span>
                                <span>Side: {prefs.sideOption}</span>
                              </span>
                            )}
                            {hasSweet && !isSatSpecial && (
                              <span className="bg-pink-50 border border-pink-200 text-pink-800 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
                                <span>🍮</span>
                                <span>Dessert ({customSpecs?.sweet === 'daily' ? 'Daily' : 'Wed & Sat'})</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Tag */}
                  <div className="bg-gray-50/60 px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> Ready for morning prep
                    </span>
                    <span className="text-gray-400 font-mono text-[10px]">8:00 AM Window</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header / Nav */}
      <div className="flex items-center justify-between">
         <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-2 text-primary hover:underline font-bold text-sm"
          >
            <ChevronLeft size={16} /> Back to Users
          </button>
      </div>

      {/* User Profile Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-[100px] -z-10"></div>
        
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary to-orange-500 text-white rounded-[2rem] flex items-center justify-center font-black text-4xl shadow-xl shadow-primary/20 flex-shrink-0">
            {userDetail.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{userDetail.name}</h1>
              {userDetail.role === 'admin' && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-widest w-fit">Admin</span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 font-medium">
              <div className="flex items-center gap-1.5"><Mail size={16} className="text-gray-400" /> {userDetail.email}</div>
              <div className="flex items-center gap-1.5"><Phone size={16} className="text-gray-400" /> {userDetail.phone}</div>
              <div className="flex items-center gap-1.5"><User size={16} className="text-gray-400" /> UID: {userDetail.uid.slice(0, 8)}...</div>
            </div>
            
            {userDetail.address && (
              <div className="flex items-start gap-1.5 text-sm text-gray-500 pt-2 border-t border-gray-100 mt-2">
                <MapPin size={16} className="text-gray-400 flex-shrink-0 mt-0.5" /> 
                <span>{userDetail.address} {userDetail.area && `(${userDetail.area})`}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Subscription & Customizations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                 <Crown className="text-primary" size={20} /> Subscription Details
               </h3>
               {subscription && (
                 <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                   subscription.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                 }`}>
                   {subscription.status}
                 </span>
               )}
            </div>
            
            <div className="p-6">
              {!subscription ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-medium">No subscription found for this user.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Plan</p>
                       <p className="font-bold text-gray-900">{subscription.plan}</p>
                       {customSpecs?.isCustom && (
                         <span className="text-[10px] text-purple-700 font-bold block mt-0.5">Custom Package</span>
                       )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Billing Type</p>
                       <div className="flex items-center gap-1 mt-0.5">
                         {subscription.isRecurring ? (
                           <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                             <Repeat size={12} /> Monthly Recurring
                           </span>
                         ) : (
                           <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                             <Package size={12} /> One-Time (30 Days)
                           </span>
                         )}
                       </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Payment Method & Status</p>
                       <div className="flex items-center gap-1.5 mt-0.5">
                         <CreditCard size={14} className="text-gray-500 shrink-0"/>
                         <span className="font-bold text-gray-900 text-xs truncate">{subscription.paymentMethod || 'Online'}</span>
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                           subscription.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                         }`}>
                           {subscription.paymentStatus}
                         </span>
                       </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Amount Paid</p>
                       <p className="font-bold text-gray-900 text-sm">
                         {subscription.totalAmount !== undefined 
                           ? `$${Number(subscription.totalAmount).toFixed(2)} CAD`
                           : (subscription.subtotal !== undefined ? `$${Number(subscription.subtotal).toFixed(2)} CAD` : 'N/A')}
                       </p>
                       {subscription.couponCode && (
                         <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Coupon: {subscription.couponCode}</span>
                       )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Delivery Schedule</p>
                       <p className="font-bold text-gray-900 text-xs">
                         {Array.isArray(subscription.deliveryDays) && subscription.deliveryDays.length > 0
                           ? subscription.deliveryDays.map((d: string) => d.slice(0, 3).toUpperCase()).join(', ')
                           : 'MON - SAT'}
                       </p>
                       <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">
                         {Array.isArray(subscription.deliveryDays) ? `${subscription.deliveryDays.length} days / week` : '6 days / week'}
                       </span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">First Scheduled Delivery</p>
                       <p className="font-bold text-emerald-700 text-xs">
                         {subscription.firstDeliveryDate 
                           ? new Date(`${subscription.firstDeliveryDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                           : (subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : 'Pending Confirmation')}
                       </p>
                       <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">Morning 8:00 AM Window</span>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Start Date</p>
                       <p className="font-bold text-gray-900 text-xs">
                         {subscription.startDate ? new Date(subscription.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Starts after acceptance'}
                       </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl">
                       <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">End Date</p>
                       <p className="font-bold text-primary text-xs">
                         {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set after acceptance'}
                       </p>
                       {subscription.remainingDays !== undefined && (
                         <span className="text-[10px] text-gray-500 font-semibold block mt-0.5">{subscription.remainingDays} days remaining</span>
                       )}
                    </div>
                  </div>

                  {subscription.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                      <strong className="block font-bold mb-0.5">Customer Delivery Notes:</strong>
                      <p>{subscription.notes}</p>
                    </div>
                  )}

                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-2">Package Contents & Inclusions Breakdown</p>
                    <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-800">
                      <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">🫓 {customSpecs?.roti ?? 8} Tawa Roti</span>
                      <span className={`px-2.5 py-1 rounded-lg border ${customSpecs?.sabzi === 0 ? 'bg-amber-100 text-amber-900 border-amber-200 font-black' : 'bg-white border-gray-200'}`}>
                        🍲 {customSpecs?.sabzi === 0 ? '0 Sabji (No Sabji Included)' : `${customSpecs?.sabzi ?? 2} Sabji`}
                      </span>
                      {customSpecs?.dal && customSpecs.dal > 0 ? (
                        <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">🥣 {customSpecs.dal} Dal Portion{customSpecs.dal > 1 ? 's' : ''}</span>
                      ) : null}
                      {customSpecs?.rice && customSpecs.rice > 0 ? (
                        <span className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">🍚 {customSpecs.rice} Rice Bowl{customSpecs.rice > 1 ? 's' : ''}</span>
                      ) : null}
                      <span className={`bg-white px-2.5 py-1 rounded-lg border border-gray-200 ${customSpecs?.raita === 'none' ? 'text-gray-400' : 'text-teal-700'}`}>
                        🥣 Raita: {customSpecs?.raita === 'daily' ? 'Daily (Mon-Sat)' : ['threePerWeek', '3days'].includes(customSpecs?.raita || '') ? '3x/week (Mon, Wed, Fri)' : 'None'}
                      </span>
                      <span className={`bg-white px-2.5 py-1 rounded-lg border border-gray-200 ${customSpecs?.salad === 'none' ? 'text-gray-400' : 'text-emerald-700'}`}>
                        🥗 Salad: {customSpecs?.salad === 'daily' ? 'Daily (Mon-Sat)' : ['threePerWeek', '3days'].includes(customSpecs?.salad || '') ? '3x/week (Mon, Wed, Fri)' : 'None'}
                      </span>
                      <span className={`bg-white px-2.5 py-1 rounded-lg border border-gray-200 ${customSpecs?.sweet === 'none' ? 'text-gray-400' : 'text-pink-700'}`}>
                        🍮 Sweet: {customSpecs?.sweet === 'daily' ? 'Daily' : ['twicePerWeek', 'weekly'].includes(customSpecs?.sweet || '') ? '2x/week (Wed, Sat)' : 'None'}
                      </span>
                      {customSpecs?.satSpecial && (
                        <span className="bg-yellow-50 text-yellow-900 border border-yellow-200 px-2.5 py-1 rounded-lg">⭐ Saturday Special Included</span>
                      )}
                    </div>
                  </div>

                  {/* Visual Progress roughly estimated by days */}
                  {subscription.status === 'Active' && subscription.remainingDays !== undefined && (
                     <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                           <span>Progress</span>
                           <span className="text-primary">{subscription.remainingDays} Days Left</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-primary rounded-full transition-all duration-500" 
                             style={{ width: `${Math.max(0, Math.min(100, ((30 - subscription.remainingDays) / 30) * 100))}%` }}
                           ></div>
                        </div>
                     </div>
                  )}

                  {subscription.status === 'Active' && (
                    <div className="pt-6 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-bold text-sm transition"
                      >
                        <Ban size={16} /> Cancel Subscription
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Calendar & Customizations */}
          {renderCalendar()}
          {renderCustomizations()}

        </div>

        {/* Right Column: Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
               <Activity className="text-primary" size={20} /> Recent Activity
             </h3>
             
              {activities.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No activity logs found.</p>
              ) : (
                <div className="space-y-4 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                  {activities.map((act, idx) => {
                    // Determine icon colors and text colors
                    let iconBg = 'bg-gray-50 border-gray-200 text-gray-500';
                    let typeBadgeColor = 'bg-gray-100 text-gray-800';
                    
                    if (act.type === 'subscription') {
                      iconBg = act.action === 'renew' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-blue-50 border-blue-200 text-blue-600';
                      typeBadgeColor = act.action === 'renew' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
                    } else if (act.type === 'cancel') {
                      iconBg = 'bg-rose-50 border-rose-200 text-rose-600';
                      typeBadgeColor = 'bg-rose-100 text-rose-800';
                    } else if (act.type === 'customization') {
                      iconBg = 'bg-purple-50 border-purple-200 text-purple-600';
                      typeBadgeColor = 'bg-purple-100 text-purple-800';
                    } else if (act.type === 'skip') {
                      iconBg = 'bg-amber-50 border-amber-200 text-amber-600';
                      typeBadgeColor = 'bg-amber-100 text-amber-800';
                    } else if (act.type === 'order') {
                      iconBg = 'bg-indigo-50 border-indigo-200 text-indigo-600';
                      typeBadgeColor = 'bg-indigo-100 text-indigo-800';
                    }

                    return (
                      <div key={idx} className="flex gap-4 items-stretch group">
                        {/* Left: Bullet & vertical line */}
                        <div className="flex flex-col items-center shrink-0 w-10">
                          {/* Bullet */}
                          <div className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 bg-white shadow-sm z-10 transition-transform group-hover:scale-105 ${iconBg}`}>
                            <Activity size={16} />
                          </div>
                          {/* Vertical Line */}
                          {idx < activities.length - 1 && (
                            <div className="w-0.5 bg-slate-100 grow my-2"></div>
                          )}
                        </div>

                        {/* Right: Card */}
                        <div className="flex-1 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all duration-200 hover:shadow-xs mb-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${typeBadgeColor}`}>
                                {act.type}
                              </span>
                              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg capitalize">
                                {act.action}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-400">
                              {new Date(act.createdAt).toLocaleString('en-CA', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          
                          <p className="text-slate-800 text-sm font-medium leading-relaxed mt-1">
                            {act.description}
                          </p>

                          {/* Metadata display if present */}
                          {act.metadata && Object.keys(act.metadata).length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200/50 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                              {Object.entries(act.metadata).map(([key, val]) => {
                                if (!val) return null;
                                // Clean key for display (e.g. orderId -> Order ID)
                                const cleanKey = key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, (str) => str.toUpperCase());
                                
                                // Format value if it's a date or long ID
                                let cleanVal = String(val);
                                if (key.toLowerCase().includes('date') && !isNaN(Date.parse(cleanVal))) {
                                  cleanVal = new Date(cleanVal).toLocaleDateString();
                                } else if (key.toLowerCase().includes('id') && cleanVal.length > 15) {
                                  cleanVal = `${cleanVal.substring(0, 8)}...`;
                                }

                                return (
                                  <div key={key} className="flex flex-col bg-white border border-slate-100 rounded-xl p-2 shadow-2xs">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{cleanKey}</span>
                                    <span className="text-slate-800 font-bold mt-0.5 truncate">{cleanVal}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => !isCancelling && setShowCancelModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"
              disabled={isCancelling}
            >
              <X size={20} />
            </button>
            
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 mb-2">Cancel Subscription</h2>
            <p className="text-sm text-gray-600 mb-6">
              This action will immediately cancel the user's active subscription. 
              <strong> They will receive a notification with the reason you provide below.</strong>
            </p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Cancellation Reason</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Requested via support, Non-payment, etc."
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm min-h-[100px] resize-none"
                  disabled={isCancelling}
                ></textarea>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 px-4 font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                disabled={isCancelling}
              >
                Keep Active
              </button>
              <button 
                onClick={handleCancelSubscription}
                disabled={!cancelReason.trim() || isCancelling}
                className="flex-1 py-3 px-4 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCancelling ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDetail;
