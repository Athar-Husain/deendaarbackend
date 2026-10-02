import Role from "../../models/Role.model.js";
import Category from "../../models/Category.model.js";
import Location from "../../models/Location.model.js";
import logger from "../../utils/logger.js";

export const seedLookups = async () => {
  const defaultRoles = [
    { key: "imam", labelEn: "Imam", labelUr: "امام", labelAr: "إمام" },
    { key: "khateeb", labelEn: "Khateeb", labelUr: "خطیب", labelAr: "خطيب" },
    { key: "muazzin", labelEn: "Muazzin", labelUr: "مؤذن", labelAr: "مؤذن" },
    { key: "teacher", labelEn: "Teacher", labelUr: "استاد", labelAr: "مدرس" },
    { key: "other", labelEn: "Other", labelUr: "دیگر", labelAr: "أخرى" },
  ];
  for (const r of defaultRoles) {
    await Role.findOneAndUpdate({ key: r.key }, r, {
      upsert: true,
      returnDocument: "after",
    });
  }
  logger.info(`Roles seeded: ${defaultRoles.length}`);

  const defaultCategories = [
    { key: "masjid", labelEn: "Masjid", labelUr: "مسجد", labelAr: "مسجد" },
    {
      key: "madrasa_boys",
      labelEn: "Madrasa (Boys)",
      labelUr: "مدرسہ (لڑکے)",
      labelAr: "مدرسة (أولاد)",
    },
    {
      key: "madrasa_girls",
      labelEn: "Madrasa (Girls)",
      labelUr: "مدرسہ (لڑکیاں)",
      labelAr: "مدرسة (بنات)",
    },
    { key: "school", labelEn: "School", labelUr: "اسکول", labelAr: "مدرسة" },
  ];
  for (const c of defaultCategories) {
    await Category.findOneAndUpdate({ key: c.key }, c, {
      upsert: true,
      returnDocument: "after",
    });
  }
  logger.info(`Categories seeded: ${defaultCategories.length}`);

  const defaultLocations = [
    { country: "India", state: "Uttar Pradesh", district: "Lucknow" },
    { country: "India", state: "Maharashtra", district: "Mumbai" },
    { country: "India", state: "Karnataka", district: "Bangalore" },
    { country: "Saudi Arabia", state: "", district: "Makkah" },
    { country: "Saudi Arabia", state: "", district: "Madinah" },
  ];
  for (const l of defaultLocations) {
    await Location.findOneAndUpdate(
      { country: l.country, state: l.state, district: l.district },
      l,
      { upsert: true, returnDocument: "after" },
    );
  }
  logger.info(`Locations seeded: ${defaultLocations.length}`);
};
