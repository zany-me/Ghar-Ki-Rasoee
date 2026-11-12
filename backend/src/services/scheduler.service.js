const SubscriptionModel = require("../models/subscription.model");
const OrderModel = require("../models/order.model");
const admin = require("../config/firebase.config");
const db = admin.firestore();

class SchedulerService {
  static async generateDailyOrders() {
    console.log("Starting Daily Order Generation...");
    const today = new Date();
    // Normalize today to YYYY-MM-DD for comparison
    const todayString = today.toISOString().split("T")[0];

    try {
      // 1. Get all Active Subscriptions
      const subscriptionsSnapshot = await SubscriptionModel.collection
        .where("status", "==", "Active")
        .get();

      if (subscriptionsSnapshot.empty) {
        console.log("No active subscriptions found.");
        return;
      }

      console.log(`Found ${subscriptionsSnapshot.size} active subscriptions.`);

      // 2. Process each subscription
      const batchPromises = subscriptionsSnapshot.docs.map(async (doc) => {
        const sub = doc.data();

        // Fetch User details for address
        const userDoc = await db.collection("users").doc(sub.userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Check if today is skipped
        if (sub.skippedDates && sub.skippedDates.includes(todayString)) {
          console.log(`Skipping order for user ${sub.userId} (Date Skipped)`);
          return;
        }

        // Skip if first delivery date has not arrived yet, or ordered today after morning delivery
        const DeliveryScheduleUtil = require("../utils/deliverySchedule.util");
        const firstDelivery = sub.firstDeliveryDate || (sub.startDate ? sub.startDate.split("T")[0] : null);
        if (firstDelivery && firstDelivery > todayString) {
          console.log(`Skipping order for user ${sub.userId} (Starts on ${firstDelivery})`);
          return;
        }

        if (sub.createdAt) {
          const createdSchedule = DeliveryScheduleUtil.getNextDeliveryDate(sub.createdAt, sub.deliveryDays);
          if (createdSchedule.deliveryDate > todayString && (!sub.startDate || sub.startDate.split("T")[0] >= todayString)) {
            console.log(`Skipping order for user ${sub.userId} (Created today after 8 AM, first delivery on ${createdSchedule.deliveryDate})`);
            return;
          }
        }

        // Check if remaining days > 0
        if (sub.remainingDays <= 0) {
          console.log(`Subscription expired for user ${sub.userId}`);
          // Optionally auto-expire here
          await SubscriptionModel.collection
            .doc(sub.subscriptionId)
            .update({ status: "Expired" });
          return;
        }

        // Prevent duplicate daily orders for this subscription
        const existingOrderSnapshot = await db.collection("orders")
            .where("subscriptionId", "==", sub.subscriptionId)
            .where("deliveryDate", "==", todayString)
            .where("generatedByScheduler", "==", true)
            .limit(1)
            .get();

        if (!existingOrderSnapshot.empty) {
            console.log(`Order already generated for subscription ${sub.subscriptionId} today.`);
            return;
        }

        // Resolve actual meal contents for the day
        const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(today).toLowerCase();
        
        // Skip Sundays
        if (dayName === "sunday") {
           console.log(`Skipping order for user ${sub.userId} (Sunday)`);
           return;
        }

        // Skip if not a scheduled delivery day for this subscription
        if (sub.deliveryDays && Array.isArray(sub.deliveryDays) && sub.deliveryDays.length > 0) {
          const isScheduled = sub.deliveryDays.some(
            (d) => d && d.toLowerCase() === dayName.toLowerCase(),
          );
          if (!isScheduled) {
            console.log(
              `Skipping order for user ${sub.userId} today (not a scheduled delivery day: ${dayName})`,
            );
            return;
          }
        }

        const CustomizationModel = require("../models/customization.model");
        const MenuModel = require("../models/menu.model");
        const customization = await CustomizationModel.getBySubscription(sub.subscriptionId);
        let todayPreference = customization?.preferences ? customization.preferences[dayName] : null;

        let finalPreference = {};
        let dayMenu = await MenuModel.getDayMenu(sub.plan, dayName);
        if (!dayMenu) {
          dayMenu = await MenuModel.getDayMenu(sub.plan, "monday");
        }
        if (dayMenu) {
          if (dayMenu.isSaturdaySpecial) {
            finalPreference.specialFood = dayMenu.specialFoodOptions ? dayMenu.specialFoodOptions[0] : "Chef's Special";
            finalPreference.dessert = dayMenu.dessertOptions ? dayMenu.dessertOptions[0] : "Sweet";
          } else {
            if (dayMenu.sabziSet1) finalPreference.sabzi1 = dayMenu.sabziSet1[0];
            if (dayMenu.sabziSet2) finalPreference.sabzi2 = dayMenu.sabziSet2[0];
            if (dayMenu.sabziOptions) {
              finalPreference.sabzi1 = dayMenu.sabziOptions[0];
              if (dayMenu.sabziOptions.length > 1 && (sub.plan.toLowerCase() === "standard" || sub.plan.toLowerCase() === "premium")) {
                finalPreference.sabzi2 = dayMenu.sabziOptions[1];
              }
            }
          }
          if (dayMenu.roti) finalPreference.roti = `${dayMenu.roti} Roti`;
          if (dayMenu.raitaType) finalPreference.side_option = dayMenu.raitaType;
          else if (dayMenu.raita) finalPreference.side_option = "Raita";
        }

        // Merge user's customizations over defaults
        if (todayPreference && Object.keys(todayPreference).length > 0) {
          finalPreference = { ...finalPreference, ...todayPreference };
        }

        // Apply custom plan overrides if defined on the subscription
        const customRoti = sub.customDetails?.roti ?? sub.planDetails?.roti ?? sub.selectedComponents?.roti ?? sub.planDetails?.selections?.roti ?? sub.customDetails?.selections?.roti ?? sub.planDetails?.selectedComponents?.roti ?? sub.customDetails?.selectedComponents?.roti;
        if (customRoti !== undefined && !isNaN(Number(customRoti))) {
          finalPreference.roti = `${customRoti} Roti`;
        }

        const customRice = sub.customDetails?.rice ?? sub.planDetails?.rice ?? sub.selectedComponents?.rice ?? sub.planDetails?.selections?.rice ?? sub.customDetails?.selections?.rice;
        if (customRice !== undefined && Number(customRice) > 0) {
          finalPreference.rice = `${customRice} Rice`;
        } else if (customRice !== undefined && Number(customRice) === 0) {
          delete finalPreference.rice;
        }

        const customDal = sub.customDetails?.dal ?? sub.planDetails?.dal ?? sub.selectedComponents?.dal ?? sub.planDetails?.selections?.dal ?? sub.customDetails?.selections?.dal;
        if (customDal !== undefined && Number(customDal) > 0) {
          finalPreference.dal = `${customDal} Dal`;
        } else if (customDal !== undefined && Number(customDal) === 0) {
          delete finalPreference.dal;
        }

        const customSabji = sub.customDetails?.sabji ?? sub.customDetails?.sabziChoices ?? sub.planDetails?.sabji ?? sub.planDetails?.sabziChoices ?? sub.selectedComponents?.sabji ?? sub.planDetails?.selections?.sabji ?? sub.customDetails?.selections?.sabji ?? sub.planDetails?.selectedComponents?.sabji ?? sub.customDetails?.selectedComponents?.sabji;
        if (customSabji !== undefined && Number(customSabji) === 0) {
          delete finalPreference.sabzi1;
          delete finalPreference.sabzi2;
          delete finalPreference.sabzi3;
          delete finalPreference.sabzi_count;
        } else if (customSabji !== undefined && Number(customSabji) === 1) {
          delete finalPreference.sabzi2;
          delete finalPreference.sabzi3;
          finalPreference.sabzi_count = "1 Sabji";
        } else if (customSabji !== undefined && Number(customSabji) > 0) {
          finalPreference.sabzi_count = `${customSabji} Sabji`;
        }

        if (finalPreference.sideOption) {
          finalPreference.side_option = finalPreference.sideOption;
          delete finalPreference.sideOption;
        }

        // Apply custom side option from subscription details
        const customRaita = sub.customDetails?.raitaFrequency ?? sub.planDetails?.raitaFrequency ?? sub.selectedComponents?.raitaFrequency ?? sub.planDetails?.selections?.raitaFrequency ?? sub.customDetails?.selections?.raitaFrequency ?? sub.customDetails?.raitaOption ?? sub.planDetails?.raitaOption;
        const customSalad = sub.customDetails?.saladFrequency ?? sub.planDetails?.saladFrequency ?? sub.selectedComponents?.saladFrequency ?? sub.planDetails?.selections?.saladFrequency ?? sub.customDetails?.selections?.saladFrequency ?? sub.customDetails?.saladOption ?? sub.planDetails?.saladOption;

        const isCustomSidePlan = Boolean(
          sub.customDetails?.isCustomPlan || sub.planDetails?.isCustomPlan || sub.planDetails?.custom ||
          (sub.plan && (sub.plan.toLowerCase().includes("custom") || sub.plan.toLowerCase().includes("scratch"))) ||
          customRaita !== undefined || customSalad !== undefined
        );

        if (isCustomSidePlan) {
          const isThreeDay = ["monday", "wednesday", "friday"].includes(dayName.toLowerCase());
          const hasRaita = customRaita === "daily" || (["threePerWeek", "3days"].includes(customRaita) && isThreeDay);
          const hasSalad = customSalad === "daily" || (["threePerWeek", "3days"].includes(customSalad) && isThreeDay);

          if (hasRaita && hasSalad) {
            finalPreference.side_option = "Raita + Salad";
          } else if (hasRaita) {
            finalPreference.side_option = "Raita";
          } else if (hasSalad) {
            finalPreference.side_option = "Salad";
          } else {
            delete finalPreference.side_option;
          }
        }

        // Clean up empty fields
        Object.keys(finalPreference).forEach(key => {
          if (finalPreference[key] === null || finalPreference[key] === undefined || finalPreference[key] === '') {
            delete finalPreference[key];
          }
        });

        // If nothing was resolved, fallback to a default label
        if (Object.keys(finalPreference).length === 0) {
          finalPreference = { meal: `Default ${sub.plan} Menu` };
        }

        // Apply robust Side Option logic: show 'Raita' by default, or 'Salad' if explicitly selected
        const planLowerClean = (sub.plan || '').toLowerCase();
        const hasSideOption = planLowerClean.includes('premium') || 
                              planLowerClean.includes('standard') || 
                              planLowerClean.includes('basic');

        if (hasSideOption) {
          if (!finalPreference.side_option || finalPreference.side_option === 'Raita or Salad' || finalPreference.side_option !== 'Salad') {
            finalPreference.side_option = 'Raita';
          }
        } else {
          delete finalPreference.side_option;
        }

        // Create the Daily Order
        const orderData = {
          userId: sub.userId,
          subscriptionId: sub.subscriptionId,
          customerName:
            userData.displayName || userData.email || "Unknown Customer",
          deliveryAddress:
            sub.deliveryAddress || userData.address || "No Address Provided",
          orderType: "Subscription",
          plan: sub.plan, // e.g. "Weekly Plan"
          items: finalPreference, // Store the exact meal items!
          price: 0, // Billed at subscription level; never collect per-delivery payment
          deliveryDate: todayString,
          paymentMethod: sub.paymentStatus === "Pending" ? "Subscription" : "Prepaid (Subscription)",
          paymentStatus: sub.paymentStatus || "Paid",
          status: "Cooking", // Auto-set to cooking for the day
          generatedByScheduler: true,
        };

        await OrderModel.createOrder(orderData);

        // Decrement remaining days
        await SubscriptionModel.collection.doc(sub.subscriptionId).update({
          remainingDays: admin.firestore.FieldValue.increment(-1),
        });

        console.log(`Generated order for user ${sub.userId}`);
      });

      await Promise.all(batchPromises);
      console.log("Daily Order Generation Completed.");
    } catch (error) {
      console.error("Error in generateDailyOrders:", error);
    }
  }
}

module.exports = SchedulerService;
