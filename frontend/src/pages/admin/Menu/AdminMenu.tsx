import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { ENV } from '../../../config/env.config';
import { toast } from 'sonner';
import { 
  Save, 
  RefreshCw, 
  Layers, 
  Calendar, 
  Image, 
  MapPin, 
  Calculator, 
  Info, 
  Plus
} from 'lucide-react';
import NumberInput from '../../../components/common/NumberInput';

interface PlanConfig {
  name: string;
  price: number;
  features: string[];
  roti?: number;
  sabziChoices?: number;
}

interface CustomPricingRules {
  pricingVersion?: number;
  removal?: {
    roti: number;
    raita: { threePerWeek: number; daily: number };
    sweetDish: { twicePerWeek: number };
    saturdaySpecial: number;
    sabji: number;
    dal: number;
    rice: number;
  };
  addition?: {
    roti: number;
    raita: { threePerWeek: number; daily: number };
    salad: { threePerWeek: number; daily: number };
    sabji: number;
    dal: number;
    rice: number;
  };
  basePrice: number;
  pricePerRoti: number;
  pricePerRice: number;
  pricePerSabzi: number;
  raitaPrice3Days: number;
  raitaPriceDaily: number;
  dessertPriceWeekly: number;
  dessertPriceDaily: number;
  saturdaySpecialPrice: number;
  // One-Time Meal Rates & Alignments
  oneTimeBasePrice?: number;
  oneTimeBaseRoti?: number;
  oneTimeBaseSabzi?: number;
  oneTimePricePerRoti?: number;
  oneTimePricePerSabzi?: number;
  oneTimeRaitaPrice?: number;
  oneTimeDessertPrice?: number;
  // Build from Scratch (Roti Only Plan)
  scratchRotiPrice?: number;
  scratchBasePrice?: number;
  scratchDefaultRoti?: number;
}

type AdjustmentRateTree = Record<string, number | Record<string, number>>;

interface MenuItem {
  sabziOptions?: string[];
  sabziSet1?: string[];
  sabziSet2?: string[];
  roti: number;
  raita?: boolean;
  raitaType?: string;
  dessert?: boolean;
  isSaturdaySpecial?: boolean;
  specialFoodOptions?: string[];
  dessertOptions?: string[];
}

interface WeeklyMenuConfig {
  monday: MenuItem;
  tuesday: MenuItem;
  wednesday: MenuItem;
  thursday: MenuItem;
  friday: MenuItem;
  saturday: MenuItem;
}

interface CityCategoryConfig {
  name: string;
  cities: string[];
  deliveryFeeSettings: {
    minAmountForFreeDelivery: number;
    deliveryFee: number;
    deliveryFeePerSelectedDay?: number;
  };
  planPrices: {
    basic: number;
    standard: number;
    premium: number;
    customizableBase: number;
  };
}

interface MenuConfig {
  plans: Record<string, PlanConfig>;
  customPricingConfig: CustomPricingRules;
  weeklyMenus: {
    basic: WeeklyMenuConfig;
    standard: WeeklyMenuConfig;
    premium: WeeklyMenuConfig;
  };
  menuImages?: {
    vancouver: string;
    others: string;
  };
  deliveryFeeSettings?: {
    minAmountForFreeDelivery: number;
    deliveryFee: number;
    deliveryFeePerSelectedDay?: number;
  };
  cityCategories?: Record<string, CityCategoryConfig>;
}

type MenuTab = 'pricing' | 'cities' | 'menu' | 'tiers' | 'images';

const AdminMenu: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MenuConfig | null>(null);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<MenuTab>('pricing');
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'standard' | 'premium'>('standard');
  const [selectedDay, setSelectedDay] = useState<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'>('monday');

  const [uploadingVancouver, setUploadingVancouver] = useState(false);
  const [uploadingOthers, setUploadingOthers] = useState(false);

  const days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  const handleImageUpload = async (file: File, type: 'vancouver' | 'others') => {
    const isVancouver = type === 'vancouver';
    if (isVancouver) setUploadingVancouver(true);
    else setUploadingOthers(true);

    try {
      const token = await user?.getIdToken();
      const formData = new FormData();
      formData.append('image', file);

      const res = await axios.post(`${ENV.API_URL}/admin/menu/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      if (res.data.success && res.data.data.url) {
        const downloadUrl = res.data.data.url;
        setConfig(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            menuImages: {
              vancouver: prev.menuImages?.vancouver || '',
              others: prev.menuImages?.others || '',
              [type]: downloadUrl
            }
          };
        });
        toast.success("Image uploaded to Cloudinary successfully! Remember to save changes.");
      } else {
        toast.error("Upload failed. Invalid response from server.");
      }
    } catch (error: any) {
      console.error("Error setting up upload:", error);
      const errMsg = error.response?.data?.message || error.message;
      toast.error(`Upload failed: ${errMsg}`);
    } finally {
      if (isVancouver) setUploadingVancouver(false);
      else setUploadingOthers(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await axios.get(`${ENV.API_URL}/admin/menu/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setConfig(res.data.data);
      }
    } catch (error) {
      console.error("Failed to load admin menu configuration:", error);
      toast.error("Failed to load menu configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [user]);

  const handleSaveConfig = async (updatedConfig: MenuConfig) => {
    try {
      setSaving(true);
      const token = await user?.getIdToken();
      const res = await axios.put(`${ENV.API_URL}/admin/menu/config`, updatedConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setConfig(res.data.data);
        toast.success("Menu configuration successfully updated in Firestore!");
      }
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error("Failed to save configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // State update handlers
  const updatePlanFeaturesArray = (planKey: string, newFeatures: string[]) => {
    if (!config) return;
    const updated = { ...config };
    updated.plans[planKey].features = newFeatures;
    setConfig(updated);
  };

  const updatePricingRule = (key: Exclude<keyof CustomPricingRules, 'removal' | 'addition'>, value: number) => {
    if (!config) return;
    const updated = { ...config };
    if (!updated.customPricingConfig) {
      updated.customPricingConfig = {
        basePrice: 100,
        pricePerRoti: 5,
        pricePerRice: 10,
        pricePerSabzi: 20,
        raitaPrice3Days: 10,
        raitaPriceDaily: 20,
        dessertPriceWeekly: 10,
        dessertPriceDaily: 20,
        saturdaySpecialPrice: 15,
        oneTimeBasePrice: 13.00,
        oneTimeBaseRoti: 8,
        oneTimeBaseSabzi: 2,
        oneTimePricePerRoti: 0.60,
        oneTimePricePerSabzi: 3.00,
        oneTimeRaitaPrice: 2.00,
        oneTimeDessertPrice: 3.00,
        scratchRotiPrice: 8,
        scratchBasePrice: 0,
        scratchDefaultRoti: 8
      };
    }
    updated.customPricingConfig[key] = value;
    setConfig(updated);
  };

  const updateAdjustmentRate = (side: 'removal' | 'addition', path: string[], value: number) => {
    if (!config || !Number.isFinite(value) || value < 0) return;
    const defaults: AdjustmentRateTree = side === 'removal'
      ? { roti: 5, raita: { threePerWeek: 10, daily: 20 }, sweetDish: { twicePerWeek: 10 }, saturdaySpecial: 15, sabji: 50, dal: 50, rice: 40 }
      : { roti: 8, raita: { threePerWeek: 15, daily: 30 }, salad: { threePerWeek: 15, daily: 30 }, sabji: 55, dal: 55, rice: 40 };
    setConfig(prev => {
      if (!prev) return prev;
      const currentSide: AdjustmentRateTree = { ...defaults, ...(prev.customPricingConfig?.[side] || {}) };
      if (path.length === 1) currentSide[path[0]] = value;
      else {
        const nested = currentSide[path[0]];
        currentSide[path[0]] = {
          ...(typeof nested === 'object' ? nested : {}),
          [path[1]]: value,
        };
      }
      return { ...prev, customPricingConfig: { ...prev.customPricingConfig, pricingVersion: 2, [side]: currentSide } };
    });
  };

  const updateDeliverySetting = (key: 'minAmountForFreeDelivery' | 'deliveryFeePerSelectedDay', value: number) => {
    if (!config) return;
    const updated = { ...config };
    if (!updated.deliveryFeeSettings) {
      updated.deliveryFeeSettings = { minAmountForFreeDelivery: 150, deliveryFee: 15 };
    }
    updated.deliveryFeeSettings[key] = value;
    setConfig(updated);
  };

  const updateCityCategorySetting = (
    categoryKey: string,
    field: 'name' | 'cities' | 'minAmountForFreeDelivery' | 'deliveryFeePerSelectedDay' | 'basic' | 'standard' | 'premium' | 'customizableBase',
    value: any
  ) => {
    if (!config) return;
    const updated = { ...config };
    if (!updated.cityCategories) {
      updated.cityCategories = {};
    }
    if (!updated.cityCategories[categoryKey]) {
      updated.cityCategories[categoryKey] = {
        name: categoryKey === 'local' ? 'Local Cities' : 'Far Cities',
        cities: [],
        deliveryFeeSettings: { minAmountForFreeDelivery: 150, deliveryFee: 15 },
        planPrices: { basic: 150, standard: 190, premium: 220, customizableBase: 100 }
      };
    }

    const cat = updated.cityCategories[categoryKey];
    if (field === 'name') {
      cat.name = value;
    } else if (field === 'cities') {
      cat.cities = value;
    } else if (field === 'minAmountForFreeDelivery' || field === 'deliveryFeePerSelectedDay') {
      cat.deliveryFeeSettings[field] = Number(value) || 0;
    } else {
      cat.planPrices[field] = Number(value) || 0;
    }
    setConfig(updated);
  };

  const updateMenuField = (field: keyof MenuItem, value: any) => {
    if (!config) return;
    const updated = { ...config };
    const targetMenu = updated.weeklyMenus[selectedPlan][selectedDay];
    (targetMenu as any)[field] = value;
    setConfig(updated);
  };

  const updateMenuArrayDirect = (field: keyof MenuItem, newArray: string[]) => {
    if (!config) return;
    const updated = { ...config };
    const targetMenu = updated.weeklyMenus[selectedPlan][selectedDay];
    (targetMenu as any)[field] = newArray;
    setConfig(updated);
  };

  const renderArrayFieldManager = (label: string, field: keyof MenuItem, options: string[], placeholder: string = "Option") => {
    const list = options || [];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider">{label}</label>
          <span className="text-[11px] text-stone-400 font-medium">{list.length} items</span>
        </div>
        <div className="space-y-2">
          {list.map((opt, idx) => (
            <div key={idx} className="flex gap-2 items-center group">
              <span className="w-6 h-6 rounded-md bg-stone-100 text-[10px] font-bold text-stone-500 flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const newArr = [...list];
                  newArr[idx] = e.target.value;
                  updateMenuArrayDirect(field, newArr);
                }}
                className="px-3.5 py-2 text-xs font-medium w-full border border-stone-200/80 rounded-xl focus:outline-none focus:border-stone-900 bg-white transition"
                placeholder={`${placeholder} #${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => {
                  const newArr = list.filter((_, i) => i !== idx);
                  updateMenuArrayDirect(field, newArr);
                }}
                className="text-stone-300 hover:text-rose-600 p-1.5 transition shrink-0"
                title="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const newArr = [...list, ""];
            updateMenuArrayDirect(field, newArr);
          }}
          className="text-xs text-stone-600 hover:text-stone-900 font-semibold flex items-center gap-1.5 pt-1 transition"
        >
          <Plus size={13} />
          <span>Add option</span>
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mb-4" />
        <p className="text-stone-400 font-normal text-xs tracking-wide">Loading menu &amp; pricing architecture...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <p className="text-stone-800 font-medium mb-3">Unable to retrieve configuration.</p>
        <button 
          onClick={fetchConfig} 
          className="px-5 py-2 text-xs font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  // Pre-calculated live values for transparent formulas & examples
  const scratchRotiPrice = config.customPricingConfig?.scratchRotiPrice ?? config.customPricingConfig?.addition?.roti ?? 8;
  const scratchBasePrice = config.customPricingConfig?.scratchBasePrice ?? 0;
  const scratchDefaultRoti = config.customPricingConfig?.scratchDefaultRoti ?? 8;
  const scratchExampleCost = (scratchBasePrice + (8 * scratchRotiPrice)).toFixed(2);

  const oneTimeBasePrice = config.customPricingConfig?.oneTimeBasePrice ?? 13.00;
  const oneTimeBaseRoti = config.customPricingConfig?.oneTimeBaseRoti ?? 8;
  const oneTimeBaseSabzi = config.customPricingConfig?.oneTimeBaseSabzi ?? 2;
  const oneTimePricePerRoti = config.customPricingConfig?.oneTimePricePerRoti ?? 0.60;
  const oneTimePricePerSabzi = config.customPricingConfig?.oneTimePricePerSabzi ?? 3.00;
  const oneTimeRaitaPrice = config.customPricingConfig?.oneTimeRaitaPrice ?? 2.00;
  const oneTimeDessertPrice = config.customPricingConfig?.oneTimeDessertPrice ?? 3.00;
  const oneTimeExampleCost = (oneTimeBasePrice + (2 * oneTimePricePerRoti) + (1 * oneTimePricePerSabzi) + oneTimeRaitaPrice).toFixed(2);

  const removalRoti = config.customPricingConfig?.removal?.roti ?? 5;
  const removalDal = config.customPricingConfig?.removal?.dal ?? 50;
  const additionRoti = config.customPricingConfig?.addition?.roti ?? 8;
  const additionRaitaDaily = config.customPricingConfig?.addition?.raita?.daily ?? 30;

  const coreBase = config.customPricingConfig?.basePrice ?? 100;
  const coreRoti = config.customPricingConfig?.pricePerRoti ?? 5;
  const coreSabzi = config.customPricingConfig?.pricePerSabzi ?? 20;
  const coreRice = config.customPricingConfig?.pricePerRice ?? 10;
  const coreRaitaDaily = config.customPricingConfig?.raitaPriceDaily ?? 20;
  const coreDessert = config.customPricingConfig?.dessertPriceWeekly ?? 10;
  const coreSatSpecial = config.customPricingConfig?.saturdaySpecialPrice ?? 15;
  const coreExampleCost = (coreBase + (6 * coreRoti) + (2 * coreSabzi) + (1 * coreRice) + coreDessert + coreSatSpecial).toFixed(2);

  const freeDeliveryThreshold = config.deliveryFeeSettings?.minAmountForFreeDelivery ?? 150;
  const deliveryDailyRate = config.deliveryFeeSettings?.deliveryFeePerSelectedDay ?? Number(((config.deliveryFeeSettings?.deliveryFee ?? 15) / 6).toFixed(2));

  return (
    <div className="w-full pb-24 text-stone-900 font-sans selection:bg-stone-200">
      
      {/* Editorial Header & Floating Save Controls */}
      <header className="sticky top-0 z-30 bg-[#FAFAF9]/95 backdrop-blur-md pt-2 pb-5 border-b border-stone-200/60 mb-8 sm:mb-10 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Administration</span>
              <span className="text-stone-300">/</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-700">Catalog &amp; Pricing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900">
              Menu &amp; Pricing Architecture
            </h1>
            <p className="text-stone-500 text-xs mt-0.5 font-normal">
              Manage custom meal pricing engines, asymmetric formulas, weekly meals, and geographic delivery rules.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchConfig}
              className="px-4 py-2 text-xs font-medium text-stone-600 bg-white border border-stone-200/80 rounded-xl hover:bg-stone-50 hover:text-stone-900 transition shadow-2xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveConfig(config)}
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Saving changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>

        {/* Recognizable Color-Badged Tabs */}
        <nav className="flex items-center gap-1.5 sm:gap-2 mt-5 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'pricing', label: 'Pricing & Add-ons', icon: Calculator, color: 'text-amber-600', activeBg: 'bg-amber-600', dot: 'bg-amber-500' },
            { id: 'cities', label: 'City Pricing & Zones', icon: MapPin, color: 'text-teal-600', activeBg: 'bg-teal-700', dot: 'bg-teal-500' },
            { id: 'menu', label: 'Weekly Menu Planner', icon: Calendar, color: 'text-blue-600', activeBg: 'bg-blue-700', dot: 'bg-blue-500' },
            { id: 'tiers', label: 'Subscription Tiers', icon: Layers, color: 'text-purple-600', activeBg: 'bg-purple-700', dot: 'bg-purple-500' },
            { id: 'images', label: 'Menu Sheets', icon: Image, color: 'text-rose-600', activeBg: 'bg-rose-700', dot: 'bg-rose-500' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as MenuTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap border ${
                  isActive
                    ? `${tab.activeBg} text-white border-transparent shadow-sm`
                    : 'bg-white border-stone-200/80 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : tab.color} />
                <span>{tab.label}</span>
                {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: PRICING & ADD-ONS (FORMULAS, BUILD FROM SCRATCH, ASYMMETRIC RATES) */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-10 sm:space-y-12">
          
          {/* SECTION 1: Build from Scratch — Roti Only Plan (Warm Amber Accent) */}
          <section className="bg-gradient-to-br from-amber-50/40 via-white to-white rounded-3xl border border-amber-250/70 border-l-4 border-l-amber-500 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(245,158,11,0.06)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-amber-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-amber-800 bg-amber-100/90 border border-amber-250 px-2.5 py-0.5 rounded-md uppercase">
                  Build from Scratch
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-amber-950 mt-1">
                  Build from Scratch — Roti Only Plan
                </h2>
                <p className="text-stone-600 text-xs mt-1 max-w-3xl">
                  Subscribers can customize a pure Roti delivery package with zero kitchen lock-in. Rotis are charged on an independent monthly rate rather than package deductions.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100/80 rounded-full border border-amber-250 text-[11px] font-bold text-amber-900 shrink-0 self-start">
                <span>Active engine</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* Amber Formula & Example Canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 bg-amber-50/70 rounded-2xl p-4 sm:p-6 border border-amber-200/80">
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-800 flex items-center gap-1">
                  <Calculator size={11} className="text-amber-700" />
                  <span>Calculation Formula</span>
                </span>
                <div className="font-mono text-xs bg-white text-amber-950 p-3 rounded-xl border border-amber-200 leading-relaxed overflow-x-auto shadow-2xs">
                  Monthly Total = Base Fee + (Rotis × Rate per Roti) × (Selected Days ÷ 6)
                </div>
                <p className="text-[11px] text-amber-900/80 font-normal">
                  Multiplying across weekday delivery cycles ensures customers who pick fewer days are charged prorated amounts safely.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-800 flex items-center gap-1">
                  <Info size={11} className="text-amber-700" />
                  <span>Live Verified Example</span>
                </span>
                <div className="text-xs bg-white text-stone-800 p-3 rounded-xl border border-amber-200 leading-relaxed font-sans shadow-2xs">
                  For a customer ordering <span className="font-bold text-amber-950">8 rotis/day</span> for <span className="font-bold text-amber-950">6 days/week</span> at <span className="font-bold text-amber-950">${scratchRotiPrice.toFixed(2)}/roti</span>:
                  <div className="mt-1 font-mono text-amber-950 font-semibold text-xs">
                    ${scratchBasePrice.toFixed(2)} base + (8 × ${scratchRotiPrice.toFixed(2)}) × (6 ÷ 6) = <span className="text-amber-900 bg-amber-100 font-bold px-2 py-0.5 rounded">${scratchExampleCost} CAD/mo</span>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800/80">
                  Updates in real time when you modify rates in the fields below.
                </p>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 block">
                  Price Per Roti
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-amber-700 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.25"
                    value={scratchRotiPrice}
                    onChange={(val) => updatePricingRule('scratchRotiPrice', val)}
                    className="w-full pl-7 pr-16 py-2.5 bg-amber-50/30 border border-amber-200/90 rounded-xl text-stone-900 text-sm font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:bg-white transition"
                  />
                  <span className="absolute right-3 text-amber-800/80 font-bold text-[10px] uppercase">CAD/roti</span>
                </div>
                <p className="text-[10px] text-stone-500">Charged per single tawa roti chosen.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 block">
                  Kitchen Service Base Fee <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-amber-700 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="1"
                    value={scratchBasePrice}
                    onChange={(val) => updatePricingRule('scratchBasePrice', val)}
                    className="w-full pl-7 pr-16 py-2.5 bg-amber-50/30 border border-amber-200/90 rounded-xl text-stone-900 text-sm font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:bg-white transition"
                  />
                  <span className="absolute right-3 text-amber-800/80 font-bold text-[10px] uppercase">CAD/mo</span>
                </div>
                <p className="text-[10px] text-stone-500">Fixed monthly kitchen fee, if applicable.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-800 block">
                  Starting Rotis Default
                </label>
                <div className="relative flex items-center">
                  <NumberInput
                    min={1}
                    step={1}
                    fallbackValue={1}
                    value={scratchDefaultRoti}
                    onChange={(val) => updatePricingRule('scratchDefaultRoti', val)}
                    className="w-full px-3.5 py-2.5 bg-amber-50/30 border border-amber-200/90 rounded-xl text-stone-900 text-sm font-bold focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:bg-white transition"
                  />
                  <span className="absolute right-3 text-amber-800/80 font-bold text-[10px] uppercase">Rotis</span>
                </div>
                <p className="text-[10px] text-stone-500">Default starting value displayed on customer stepper.</p>
              </div>
            </div>
          </section>

          {/* SECTION 2: Asymmetric Subscription Adjustments (Rose for Removal, Emerald for Addition) */}
          <section className="bg-white rounded-3xl border border-stone-200/70 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-stone-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md uppercase">
                  Pricing Engine V2
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 mt-1">
                  Asymmetric Plan Adjustments (Additions &amp; Deductions)
                </h2>
                <p className="text-stone-500 text-xs mt-1 max-w-3xl">
                  Independent pricing for item additions versus item removals. Prevents arbitrage so customers adding items pay the true preparation cost, while removing items yields fair deductions.
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full self-start">
                Asymmetric Rules
              </span>
            </div>

            {/* Formula Cards for Additions & Deductions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              
              {/* Item Removal Column (Rose / Coral Theme) */}
              <div className="rounded-2xl border border-rose-200/80 border-l-4 border-l-rose-500 bg-gradient-to-b from-rose-50/30 via-white to-white p-5 sm:p-6 space-y-4">
                <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-rose-900">
                      Item Removal — Deduction Formula
                    </span>
                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100/90 border border-rose-200 px-2 py-0.5 rounded-md">
                      Subtracted (-)
                    </span>
                  </div>
                  <div className="font-mono text-xs bg-white text-rose-950 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
                    Quote = Base Plan - (Deductions × Days ÷ 6)
                  </div>
                  <p className="text-[11px] text-rose-900/80">
                    Example: Customer on Standard ($190) removes 1 Roti (-${removalRoti}) and Dal (-${removalDal}):
                    <span className="font-mono font-bold text-rose-950 block mt-0.5">
                      $190 - ${removalRoti} - ${removalDal} = ${(190 - removalRoti - removalDal).toFixed(2)} CAD/mo
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Roti · 1', path: ['roti'], value: config.customPricingConfig?.removal?.roti ?? 5 },
                    { label: 'Sabji · 1', path: ['sabji'], value: config.customPricingConfig?.removal?.sabji ?? 50 },
                    { label: 'Dal · 1', path: ['dal'], value: config.customPricingConfig?.removal?.dal ?? 50 },
                    { label: 'Rice · 1', path: ['rice'], value: config.customPricingConfig?.removal?.rice ?? 40 },
                    { label: 'Raita · 3x/week', path: ['raita', 'threePerWeek'], value: config.customPricingConfig?.removal?.raita?.threePerWeek ?? 10 },
                    { label: 'Raita · Daily', path: ['raita', 'daily'], value: config.customPricingConfig?.removal?.raita?.daily ?? 20 },
                    { label: 'Sweet Dish · 2x/week', path: ['sweetDish', 'twicePerWeek'], value: config.customPricingConfig?.removal?.sweetDish?.twicePerWeek ?? 10 },
                    { label: 'Saturday Special · 1', path: ['saturdaySpecial'], value: config.customPricingConfig?.removal?.saturdaySpecial ?? 15 },
                  ].map((rate) => (
                    <div key={rate.label} className="bg-white border border-rose-200/70 rounded-xl p-2.5 space-y-1 shadow-2xs">
                      <span className="text-[11px] font-semibold text-stone-700 block truncate">{rate.label}</span>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-rose-600 font-bold text-xs">$</span>
                        <NumberInput
                          min={0}
                          step="0.01"
                          value={rate.value}
                          onChange={(val) => updateAdjustmentRate('removal', rate.path, val)}
                          className="w-full pl-6 pr-8 py-1.5 bg-rose-50/20 border border-rose-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 focus:bg-white transition"
                        />
                        <span className="absolute right-2 text-rose-600/70 text-[9px] font-bold uppercase">CAD</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item Addition Column (Emerald / Green Theme) */}
              <div className="rounded-2xl border border-emerald-200/80 border-l-4 border-l-emerald-500 bg-gradient-to-b from-emerald-50/30 via-white to-white p-5 sm:p-6 space-y-4">
                <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-900">
                      Item Addition — Extra Charge Formula
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Added (+)
                    </span>
                  </div>
                  <div className="font-mono text-xs bg-white text-emerald-950 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                    Quote = Base Plan + (Additions × Days ÷ 6)
                  </div>
                  <p className="text-[11px] text-emerald-900/80">
                    Example: Customer on Standard ($190) adds +2 Rotis (+${additionRoti * 2}) and Daily Raita (+${additionRaitaDaily}):
                    <span className="font-mono font-bold text-emerald-950 block mt-0.5">
                      $190 + ${additionRoti * 2} + ${additionRaitaDaily} = ${(190 + (additionRoti * 2) + additionRaitaDaily).toFixed(2)} CAD/mo
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Roti · 1 (Preset Extra)', path: ['roti'], value: config.customPricingConfig?.addition?.roti ?? 8 },
                    { label: 'Sabji · 1', path: ['sabji'], value: config.customPricingConfig?.addition?.sabji ?? 55 },
                    { label: 'Dal · 1', path: ['dal'], value: config.customPricingConfig?.addition?.dal ?? 55 },
                    { label: 'Rice · 1', path: ['rice'], value: config.customPricingConfig?.addition?.rice ?? 40 },
                    { label: 'Raita · 3x/week', path: ['raita', 'threePerWeek'], value: config.customPricingConfig?.addition?.raita?.threePerWeek ?? 15 },
                    { label: 'Raita · Daily', path: ['raita', 'daily'], value: config.customPricingConfig?.addition?.raita?.daily ?? 30 },
                    { label: 'Salad · 3x/week', path: ['salad', 'threePerWeek'], value: config.customPricingConfig?.addition?.salad?.threePerWeek ?? 15 },
                    { label: 'Salad · Daily', path: ['salad', 'daily'], value: config.customPricingConfig?.addition?.salad?.daily ?? 30 },
                  ].map((rate) => (
                    <div key={rate.label} className="bg-white border border-emerald-200/70 rounded-xl p-2.5 space-y-1 shadow-2xs">
                      <span className="text-[11px] font-semibold text-stone-700 block truncate">{rate.label}</span>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-emerald-600 font-bold text-xs">$</span>
                        <NumberInput
                          min={0}
                          step="0.01"
                          value={rate.value}
                          onChange={(val) => updateAdjustmentRate('addition', rate.path, val)}
                          className="w-full pl-6 pr-8 py-1.5 bg-emerald-50/20 border border-emerald-200 rounded-lg text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white transition"
                        />
                        <span className="absolute right-2 text-emerald-600/70 text-[9px] font-bold uppercase">CAD</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* SECTION 3: One-Time Meal Rates (Warm Terracotta / Orange Theme) */}
          <section className="bg-gradient-to-br from-orange-50/30 via-white to-white rounded-3xl border border-orange-200/80 border-l-4 border-l-orange-500 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(249,115,22,0.06)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-orange-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-orange-800 bg-orange-100/90 border border-orange-250 px-2.5 py-0.5 rounded-md uppercase">
                  Single Orders
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-orange-950 mt-1">
                  One-Time Meal Single Order Rates
                </h2>
                <p className="text-stone-600 text-xs mt-1 max-w-3xl">
                  Used by the instant single-order calculator on the public Pricing page for customers ordering individual dinner boxes.
                </p>
              </div>
              <span className="text-[11px] font-bold text-orange-900 bg-orange-100/90 border border-orange-250 px-3 py-1 rounded-full self-start">
                Non-recurring
              </span>
            </div>

            {/* Formula & Live Example */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 bg-orange-50/60 rounded-2xl p-4 sm:p-6 border border-orange-200/80">
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-orange-800 flex items-center gap-1">
                  <Calculator size={11} className="text-orange-700" />
                  <span>One-Time Order Formula</span>
                </span>
                <div className="font-mono text-xs bg-white text-orange-950 p-3 rounded-xl border border-orange-200 shadow-2xs">
                  Total = Base Price + (Extra Rotis × Rate) + (Extra Sabzis × Rate) + Add-ons
                </div>
                <p className="text-[11px] text-orange-900/80 font-normal">
                  Base meal package includes standard baseline counts for rotis and sabzis.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-orange-800 flex items-center gap-1">
                  <Info size={11} className="text-orange-700" />
                  <span>Example Calculation</span>
                </span>
                <div className="text-xs bg-white text-stone-800 p-3 rounded-xl border border-orange-200 font-sans leading-relaxed shadow-2xs">
                  Customer orders <span className="font-bold text-orange-950">10 rotis</span> (+2 rotis), <span className="font-bold text-orange-950">3 sabzis</span> (+1 sabzi) with <span className="font-bold text-orange-950">extra Raita</span>:
                  <div className="mt-1 font-mono text-orange-950 font-semibold text-xs">
                    ${oneTimeBasePrice.toFixed(2)} + (2 × ${oneTimePricePerRoti.toFixed(2)}) + (1 × ${oneTimePricePerSabzi.toFixed(2)}) + ${oneTimeRaitaPrice.toFixed(2)} = <span className="text-orange-900 bg-orange-100 font-bold px-2 py-0.5 rounded">${oneTimeExampleCost} CAD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rates Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Base Price</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-orange-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={oneTimeBasePrice}
                    onChange={(val) => updatePricingRule('oneTimeBasePrice', val)}
                    className="w-full pl-6 pr-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Included Rotis</label>
                <NumberInput
                  min={0}
                  step={1}
                  value={oneTimeBaseRoti}
                  onChange={(val) => updatePricingRule('oneTimeBaseRoti', val)}
                  className="w-full px-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Included Sabzis</label>
                <NumberInput
                  min={0}
                  step={1}
                  value={oneTimeBaseSabzi}
                  onChange={(val) => updatePricingRule('oneTimeBaseSabzi', val)}
                  className="w-full px-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">± Rate / Roti</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-orange-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.1"
                    value={oneTimePricePerRoti}
                    onChange={(val) => updatePricingRule('oneTimePricePerRoti', val)}
                    className="w-full pl-6 pr-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">± Rate / Sabzi</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-orange-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={oneTimePricePerSabzi}
                    onChange={(val) => updatePricingRule('oneTimePricePerSabzi', val)}
                    className="w-full pl-6 pr-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">+ Extra Raita</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-orange-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={oneTimeRaitaPrice}
                    onChange={(val) => updatePricingRule('oneTimeRaitaPrice', val)}
                    className="w-full pl-6 pr-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">+ Extra Sweet</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-orange-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={oneTimeDessertPrice}
                    onChange={(val) => updatePricingRule('oneTimeDessertPrice', val)}
                    className="w-full pl-6 pr-3 py-2 bg-orange-50/20 border border-orange-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: Monthly Core Components & Supplements (Royal Indigo Theme) */}
          <section className="bg-gradient-to-br from-indigo-50/30 via-white to-white rounded-3xl border border-indigo-200/80 border-l-4 border-l-indigo-500 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(99,102,241,0.06)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-indigo-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-800 bg-indigo-100/90 border border-indigo-250 px-2.5 py-0.5 rounded-md uppercase">
                  Legacy Monthly Core
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-indigo-950 mt-1">
                  Monthly Custom Core &amp; Monthly Supplements
                </h2>
                <p className="text-stone-600 text-xs mt-1 max-w-3xl">
                  Used by legacy subscriber calculators and monthly addon recurring billing.
                </p>
              </div>
            </div>

            {/* Formula banner */}
            <div className="bg-indigo-50/60 rounded-2xl p-4 sm:p-5 border border-indigo-200/80 text-xs text-stone-800 font-sans space-y-1.5">
              <div className="font-mono text-xs text-indigo-950 font-bold">
                Monthly Core = Base (${coreBase}) + (Rotis × ${coreRoti}) + (Sabzis × ${coreSabzi}) + (Rice × ${coreRice}) + Supplements
              </div>
              <p className="text-[11px] text-indigo-900/80">
                Example with 6 rotis, 2 sabzis, 1 rice, Wed Dessert (${coreDessert}), Sat Special (${coreSatSpecial}): Total = <span className="font-bold text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded">${coreExampleCost} CAD/mo</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Base Price</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreBase}
                    onChange={(val) => updatePricingRule('basePrice', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Roti / mo</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={coreRoti}
                    onChange={(val) => updatePricingRule('pricePerRoti', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Rice / mo</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreRice}
                    onChange={(val) => updatePricingRule('pricePerRice', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Sabzi / mo</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreSabzi}
                    onChange={(val) => updatePricingRule('pricePerSabzi', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Raita 3d/wk</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={config.customPricingConfig?.raitaPrice3Days ?? 10}
                    onChange={(val) => updatePricingRule('raitaPrice3Days', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Raita Daily</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreRaitaDaily}
                    onChange={(val) => updatePricingRule('raitaPriceDaily', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Wed Dessert</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreDessert}
                    onChange={(val) => updatePricingRule('dessertPriceWeekly', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-800 block">Sat Special</label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-indigo-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={coreSatSpecial}
                    onChange={(val) => updatePricingRule('saturdaySpecialPrice', val)}
                    className="w-full pl-6 pr-2 py-2 bg-indigo-50/20 border border-indigo-200/80 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: Global Fallback Delivery Defaults (Teal / Cyan Theme) */}
          <section className="bg-gradient-to-br from-teal-50/40 via-white to-white rounded-3xl border border-teal-200/80 border-l-4 border-l-teal-500 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(20,184,166,0.06)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-teal-100 pb-5">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-teal-800 bg-teal-100/90 border border-teal-250 px-2.5 py-0.5 rounded-md uppercase">
                  Fulfillment
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-teal-950 mt-1">
                  Global Fallback Delivery Settings
                </h2>
                <p className="text-stone-600 text-xs mt-1 max-w-3xl">
                  Applied across subscriptions whenever an address does not match a city-specific configuration rule.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-teal-50/60 rounded-2xl p-4 sm:p-6 border border-teal-200/80">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-800 block">
                  Free Delivery Threshold ($ CAD)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-teal-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step={1}
                    value={freeDeliveryThreshold}
                    onChange={(val) => updateDeliverySetting('minAmountForFreeDelivery', val)}
                    className="w-full pl-7 pr-12 py-2.5 bg-white border border-teal-200 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
                  />
                  <span className="absolute right-3 text-teal-700 text-[10px] uppercase font-bold">CAD</span>
                </div>
                <p className="text-[11px] text-teal-900/80">Orders equal to or above this subtotal get 100% free delivery.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-800 block">
                  One-Day Delivery Rate ($ CAD / Selected Day)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-teal-600 font-bold text-xs">$</span>
                  <NumberInput
                    min={0}
                    step="0.01"
                    value={deliveryDailyRate}
                    onChange={(val) => updateDeliverySetting('deliveryFeePerSelectedDay', val)}
                    className="w-full pl-7 pr-12 py-2.5 bg-white border border-teal-200 rounded-xl text-sm font-bold text-stone-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
                  />
                  <span className="absolute right-3 text-teal-700 text-[10px] uppercase font-bold">CAD/day</span>
                </div>
                <p className="text-[11px] text-teal-900/80">
                  Example: 6 delivery days = ${(6 * deliveryDailyRate).toFixed(2)} CAD delivery fee for subtotal &lt; ${freeDeliveryThreshold}.
                </p>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CITY PRICING & ZONES                                               */}
      {/* ========================================================================= */}
      {activeTab === 'cities' && (
        <div className="space-y-8">
          <section className="bg-white rounded-3xl border border-stone-200/60 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] space-y-6">
            <div className="border-b border-stone-100 pb-5">
              <span className="text-[10px] font-extrabold tracking-widest text-teal-800 bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded-md uppercase">
                Geographic Tiering
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 mt-1">
                City Pricing &amp; Delivery Zones
              </h2>
              <p className="text-stone-500 text-xs mt-1 max-w-3xl">
                Configure baseline plan prices and free delivery thresholds for local vs far municipal zones.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {(['local', 'far'] as const).map((catKey) => {
                const category = config.cityCategories?.[catKey] || {
                  name: catKey === 'local' ? 'Local Cities' : 'Far Cities',
                  cities: [],
                  deliveryFeeSettings: { minAmountForFreeDelivery: 150, deliveryFee: 15 },
                  planPrices: { basic: 150, standard: 190, premium: 220, customizableBase: 100 }
                };

                const isLocal = catKey === 'local';

                return (
                  <div 
                    key={catKey} 
                    className={`rounded-2xl border p-5 sm:p-6 space-y-5 ${
                      isLocal 
                        ? 'border-sky-250 border-l-4 border-l-sky-500 bg-gradient-to-b from-sky-50/30 via-white to-white' 
                        : 'border-purple-250 border-l-4 border-l-purple-500 bg-gradient-to-b from-purple-50/30 via-white to-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-stone-200/50 pb-4">
                      <div>
                        <span className={`text-[10px] font-bold uppercase ${isLocal ? 'text-sky-700' : 'text-purple-700'}`}>
                          Zone Category
                        </span>
                        <input
                          type="text"
                          value={category.name}
                          onChange={(e) => updateCityCategorySetting(catKey, 'name', e.target.value)}
                          className="font-bold text-stone-900 text-base bg-transparent border-b border-dashed border-stone-300 focus:border-stone-900 focus:outline-none w-full"
                        />
                      </div>
                      <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded ${
                        isLocal ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'
                      } self-start`}>
                        Zone: {catKey}
                      </span>
                    </div>

                    {/* Cities Tag Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-stone-700 uppercase tracking-wider">Assigned Cities</label>
                        <span className="text-[11px] text-stone-400 font-medium">{category.cities.length} cities</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-3 bg-white border border-stone-200/80 rounded-xl min-h-[56px]">
                        {category.cities.map((city, cIdx) => (
                          <span
                            key={cIdx}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isLocal ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}
                          >
                            <span>{city}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newCities = category.cities.filter((_, i) => i !== cIdx);
                                updateCityCategorySetting(catKey, 'cities', newCities);
                              }}
                              className="text-stone-400 hover:text-rose-600 transition"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id={`new-city-${catKey}`}
                          placeholder="e.g. Richmond, Burnaby"
                          className="px-3.5 py-1.5 text-xs bg-white border border-stone-200/80 rounded-xl flex-1 focus:outline-none focus:border-stone-900 font-medium"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.currentTarget;
                              const val = input.value.trim();
                              if (val && !category.cities.includes(val)) {
                                updateCityCategorySetting(catKey, 'cities', [...category.cities, val]);
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`new-city-${catKey}`) as HTMLInputElement;
                            if (input && input.value.trim() && !category.cities.includes(input.value.trim())) {
                              updateCityCategorySetting(catKey, 'cities', [...category.cities, input.value.trim()]);
                              input.value = '';
                            }
                          }}
                          className={`px-3.5 py-1.5 text-white rounded-xl text-xs font-semibold transition ${
                            isLocal ? 'bg-sky-700 hover:bg-sky-800' : 'bg-purple-700 hover:bg-purple-800'
                          }`}
                        >
                          + Add City
                        </button>
                      </div>
                    </div>

                    {/* Plan Prices for this Zone */}
                    <div className="space-y-2 pt-2 border-t border-stone-200/50">
                      <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider block">Zone Package Base Prices</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200/70">
                          <span className="text-[10px] text-emerald-700 font-bold block">Basic</span>
                          <div className="relative flex items-center mt-1">
                            <span className="absolute left-2 text-stone-400 text-xs">$</span>
                            <NumberInput
                              min={0}
                              value={category.planPrices.basic}
                              onChange={(val) => updateCityCategorySetting(catKey, 'basic', val)}
                              className="w-full pl-5 pr-2 py-1 bg-stone-50/50 border border-stone-200 rounded text-xs font-bold text-stone-900"
                            />
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-stone-200/70">
                          <span className="text-[10px] text-blue-700 font-bold block">Standard</span>
                          <div className="relative flex items-center mt-1">
                            <span className="absolute left-2 text-stone-400 text-xs">$</span>
                            <NumberInput
                              min={0}
                              value={category.planPrices.standard}
                              onChange={(val) => updateCityCategorySetting(catKey, 'standard', val)}
                              className="w-full pl-5 pr-2 py-1 bg-stone-50/50 border border-stone-200 rounded text-xs font-bold text-stone-900"
                            />
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-stone-200/70">
                          <span className="text-[10px] text-purple-700 font-bold block">Premium</span>
                          <div className="relative flex items-center mt-1">
                            <span className="absolute left-2 text-stone-400 text-xs">$</span>
                            <NumberInput
                              min={0}
                              value={category.planPrices.premium}
                              onChange={(val) => updateCityCategorySetting(catKey, 'premium', val)}
                              className="w-full pl-5 pr-2 py-1 bg-stone-50/50 border border-stone-200 rounded text-xs font-bold text-stone-900"
                            />
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-stone-200/70">
                          <span className="text-[10px] text-amber-700 font-bold block">Custom Base</span>
                          <div className="relative flex items-center mt-1">
                            <span className="absolute left-2 text-stone-400 text-xs">$</span>
                            <NumberInput
                              min={0}
                              value={category.planPrices.customizableBase}
                              onChange={(val) => updateCityCategorySetting(catKey, 'customizableBase', val)}
                              className="w-full pl-5 pr-2 py-1 bg-stone-50/50 border border-stone-200 rounded text-xs font-bold text-stone-900"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Zone Delivery Fee */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200/50">
                      <div>
                        <span className="text-[10px] font-bold text-stone-700 block">Free Threshold ($)</span>
                        <div className="relative flex items-center mt-1">
                          <span className="absolute left-2 text-stone-400 text-xs">$</span>
                          <NumberInput
                            min={0}
                            value={category.deliveryFeeSettings.minAmountForFreeDelivery}
                            onChange={(val) => updateCityCategorySetting(catKey, 'minAmountForFreeDelivery', val)}
                            className="w-full pl-5 pr-2 py-1 bg-white border border-stone-200 rounded text-xs font-bold text-stone-900"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-stone-700 block">Daily Rate ($/day)</span>
                        <div className="relative flex items-center mt-1">
                          <span className="absolute left-2 text-stone-400 text-xs">$</span>
                          <NumberInput
                            min={0}
                            step="0.01"
                            value={category.deliveryFeeSettings.deliveryFeePerSelectedDay ?? Number(((category.deliveryFeeSettings.deliveryFee || 15) / 6).toFixed(2))}
                            onChange={(val) => updateCityCategorySetting(catKey, 'deliveryFeePerSelectedDay', val)}
                            className="w-full pl-5 pr-2 py-1 bg-white border border-stone-200 rounded text-xs font-bold text-stone-900"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WEEKLY MENU PLANNER                                                */}
      {/* ========================================================================= */}
      {activeTab === 'menu' && (
        <div className="space-y-6 sm:space-y-8">
          <section className="bg-white rounded-3xl border border-stone-200/60 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] space-y-6">
            <div className="border-b border-stone-100 pb-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-blue-800 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-md uppercase">
                  Weekly Dispatch
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 mt-1">
                  Weekly Menu Schedule
                </h2>
                <p className="text-stone-500 text-xs mt-0.5">
                  Configure recipes, roti sizes, and specials served to subscribers for every weekday.
                </p>
              </div>

              {/* Tier Switcher Pills with Distinct Colors */}
              <div className="flex gap-1.5 p-1 bg-stone-100 rounded-xl self-start sm:self-auto">
                {[
                  { tier: 'basic', color: 'text-emerald-700', active: 'bg-emerald-600 text-white' },
                  { tier: 'standard', color: 'text-blue-700', active: 'bg-blue-600 text-white' },
                  { tier: 'premium', color: 'text-purple-700', active: 'bg-purple-600 text-white' },
                ].map(({ tier, color, active }) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedPlan(tier as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                      selectedPlan === tier ? `${active} shadow-sm` : `${color} hover:bg-white/80`
                    }`}
                  >
                    {tier} Plan
                  </button>
                ))}
              </div>
            </div>

            {/* Weekday Switcher Strip */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {days.map((day) => {
                const isActive = selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition text-center border ${
                      isActive
                        ? 'bg-blue-700 border-blue-700 text-white shadow-sm'
                        : 'bg-stone-50/70 border-stone-200/70 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Editing Card for Day & Tier */}
            <div className="pt-4 border-t border-stone-100 space-y-6">
              
              {/* Special Handler for Saturday on Premium */}
              {selectedDay === 'saturday' && selectedPlan === 'premium' ? (
                <div className="space-y-6">
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-250 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm">Chef's Saturday Special Toggle</h4>
                      <p className="text-xs text-amber-800 mt-0.5">When toggled, subscribers pick a special weekend item instead of standard weekday meals.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={!!config.weeklyMenus.premium.saturday.isSaturdaySpecial}
                        onChange={(e) => updateMenuField('isSaturdaySpecial', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {config.weeklyMenus.premium.saturday.isSaturdaySpecial && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                      <div className="p-4 rounded-2xl bg-white border border-amber-200">
                        {renderArrayFieldManager('Special Dishes Options', 'specialFoodOptions', config.weeklyMenus.premium.saturday.specialFoodOptions || [], 'Special Dish')}
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-amber-200">
                        {renderArrayFieldManager('Weekend Desserts', 'dessertOptions', config.weeklyMenus.premium.saturday.dessertOptions || [], 'Dessert')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Regular Day Setup */
                <div className="space-y-6">
                  {selectedPlan === 'basic' ? (
                    <div className="p-5 rounded-2xl bg-white border border-stone-200/70">
                      {renderArrayFieldManager('Sabzi Options List', 'sabziOptions', config.weeklyMenus.basic[selectedDay].sabziOptions || [], 'Sabzi')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                      <div className="p-5 rounded-2xl bg-white border border-stone-200/70">
                        {renderArrayFieldManager('Sabzi Set 1 Options', 'sabziSet1', config.weeklyMenus[selectedPlan][selectedDay].sabziSet1 || [], 'Sabzi')}
                      </div>
                      <div className="p-5 rounded-2xl bg-white border border-stone-200/70">
                        {renderArrayFieldManager('Sabzi Set 2 Options', 'sabziSet2', config.weeklyMenus[selectedPlan][selectedDay].sabziSet2 || [], 'Sabzi')}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100 items-end">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 block">Default Roti Count</label>
                      <NumberInput
                        min={0}
                        value={config.weeklyMenus[selectedPlan][selectedDay].roti}
                        onChange={(val) => updateMenuField('roti', val)}
                        className="px-3.5 py-2 w-full border border-stone-200 rounded-xl font-semibold text-sm focus:outline-none focus:border-stone-900 bg-white"
                      />
                    </div>

                    {selectedPlan === 'premium' ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700 block">Daily Raita Dish</label>
                        <input
                          type="text"
                          value={config.weeklyMenus.premium[selectedDay].raitaType || ''}
                          onChange={(e) => updateMenuField('raitaType', e.target.value)}
                          className="px-3.5 py-2 w-full border border-stone-200 rounded-xl font-semibold text-sm focus:outline-none focus:border-stone-900 bg-white"
                          placeholder="Boondi Raita, Cucumber Raita"
                        />
                      </div>
                    ) : (
                      <div className="border border-stone-200 rounded-xl p-3 flex items-center justify-between bg-stone-50/50">
                        <label htmlFor="raita-toggle" className="text-xs font-semibold text-stone-700 cursor-pointer">Include Raita Side</label>
                        <input
                          type="checkbox"
                          id="raita-toggle"
                          checked={!!config.weeklyMenus[selectedPlan][selectedDay].raita}
                          onChange={(e) => updateMenuField('raita', e.target.checked)}
                          className="h-4 w-4 rounded text-stone-900 focus:ring-0 border-stone-300 cursor-pointer"
                        />
                      </div>
                    )}

                    {selectedPlan === 'premium' && selectedDay === 'wednesday' && (
                      <div className="border border-stone-200 rounded-xl p-3 flex items-center justify-between bg-stone-50/50">
                        <label htmlFor="dessert-toggle" className="text-xs font-semibold text-stone-700 cursor-pointer">Wednesday Dessert</label>
                        <input
                          type="checkbox"
                          id="dessert-toggle"
                          checked={!!config.weeklyMenus.premium[selectedDay].dessert}
                          onChange={(e) => updateMenuField('dessert', e.target.checked)}
                          className="h-4 w-4 rounded text-stone-900 focus:ring-0 border-stone-300 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUBSCRIPTION TIERS & FEATURES (Distinct Color Ribbons)             */}
      {/* ========================================================================= */}
      {activeTab === 'tiers' && (
        <div className="space-y-8">
          <section className="bg-white rounded-3xl border border-stone-200/60 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] space-y-6">
            <div className="border-b border-stone-100 pb-5">
              <span className="text-[10px] font-extrabold tracking-widest text-purple-800 bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-md uppercase">
                Customer Features
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 mt-1">
                Subscription Tier Inclusions
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                Configure the customer-facing feature bullet points displayed on the pricing selection cards. Base prices are managed in City Pricing &amp; Zones.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
              {[
                { planKey: 'basic', label: 'Basic Tier', color: 'border-t-4 border-t-emerald-500 bg-emerald-50/15', badge: 'bg-emerald-100 text-emerald-800' },
                { planKey: 'standard', label: 'Standard Tier', color: 'border-t-4 border-t-blue-500 bg-blue-50/15', badge: 'bg-blue-100 text-blue-800' },
                { planKey: 'premium', label: 'Premium Tier', color: 'border-t-4 border-t-purple-500 bg-purple-50/15', badge: 'bg-purple-100 text-purple-800' },
                { planKey: 'customizable', label: 'Custom Builder', color: 'border-t-4 border-t-amber-500 bg-amber-50/15', badge: 'bg-amber-100 text-amber-800' },
              ].map(({ planKey, label, color, badge }) => {
                const plan = config.plans[planKey];
                if (!plan) return null;

                return (
                  <div key={planKey} className={`rounded-2xl border border-stone-200/80 ${color} p-5 space-y-4 flex flex-col justify-between`}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-stone-200/60 pb-3">
                        <div>
                          <h3 className="font-bold text-stone-900 capitalize text-sm">{label}</h3>
                          <span className="text-[10px] text-stone-400 font-normal">Pricing card features</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badge}`}>
                          {plan.features.length} points
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex gap-2 items-center group">
                            <span className="w-5 h-5 rounded bg-white text-[9px] font-bold text-stone-700 border border-stone-200 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={feature}
                              onChange={(e) => {
                                const newFeatures = [...plan.features];
                                newFeatures[idx] = e.target.value;
                                updatePlanFeaturesArray(planKey, newFeatures);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold w-full border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 bg-white"
                              placeholder={`Feature #${idx + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newFeatures = plan.features.filter((_, i) => i !== idx);
                                updatePlanFeaturesArray(planKey, newFeatures);
                              }}
                              className="text-stone-300 hover:text-rose-600 p-1 transition shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newFeatures = [...plan.features, ""];
                        updatePlanFeaturesArray(planKey, newFeatures);
                      }}
                      className="text-xs text-stone-800 hover:text-stone-950 font-bold flex items-center gap-1.5 pt-2 border-t border-stone-200/60 transition"
                    >
                      <Plus size={13} />
                      <span>Add feature point</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MENU SHEETS (IMAGE UPLOADS) (Rose Theme)                           */}
      {/* ========================================================================= */}
      {activeTab === 'images' && (
        <div className="space-y-8">
          <section className="bg-white rounded-3xl border border-stone-200/60 p-6 sm:p-8 lg:p-10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] space-y-6">
            <div className="border-b border-stone-100 pb-5">
              <span className="text-[10px] font-extrabold tracking-widest text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-md uppercase">
                Public Collateral
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 mt-1">
                Weekly Visual Menu Sheets
              </h2>
              <p className="text-stone-500 text-xs mt-1">
                Upload image assets displayed on the public customer /menu page based on the visitor&apos;s city.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Sheet 1: Vancouver, Burnaby, Richmond, New Westminster */}
              <div className="p-5 sm:p-6 rounded-2xl border border-rose-200/80 border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50/20 via-white to-white space-y-4">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Vancouver &amp; Core Cities Menu</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Shown to users visiting from Vancouver, Burnaby, Richmond, New Westminster, and Langley.</p>
                </div>

                <div className="space-y-3">
                  <div className="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 flex items-center justify-center">
                    {config.menuImages?.vancouver ? (
                      <img src={config.menuImages.vancouver} alt="Vancouver Menu" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-stone-400 font-medium">No image uploaded</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="upload-vancouver"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'vancouver');
                      }}
                    />
                    <label
                      htmlFor="upload-vancouver"
                      className="px-4 py-2 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Image size={13} />
                      <span>{uploadingVancouver ? 'Uploading...' : 'Upload Image'}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sheet 2: Remaining Cities */}
              <div className="p-5 sm:p-6 rounded-2xl border border-rose-200/80 border-l-4 border-l-rose-500 bg-gradient-to-br from-rose-50/20 via-white to-white space-y-4">
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">Surrey, Delta &amp; Other Cities Menu</h3>
                  <p className="text-xs text-stone-500 mt-0.5">Shown to visitors across Surrey, Delta, Abbotsford, and all other serviced locations.</p>
                </div>

                <div className="space-y-3">
                  <div className="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 flex items-center justify-center">
                    {config.menuImages?.others ? (
                      <img src={config.menuImages.others} alt="Other Cities Menu" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-stone-400 font-medium">No image uploaded</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="upload-others"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'others');
                      }}
                    />
                    <label
                      htmlFor="upload-others"
                      className="px-4 py-2 bg-rose-700 text-white rounded-xl text-xs font-semibold hover:bg-rose-800 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Image size={13} />
                      <span>{uploadingOthers ? 'Uploading...' : 'Upload Image'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

    </div>
  );
};

export default AdminMenu;
