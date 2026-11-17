// One-line dish descriptions, keyed by menu item id.
// DRAFTS written on 2026-11-17 at the owner's request from the dish names and menu photos.
// The trucks have not confirmed them: the owner should review each line (Admin → Menus → Edit).
// They describe the dish only; no allergen, portion or side-dish claims.

export const DEFAULT_SERVES = 4; // owner: "put 4 for now"; edit per dish in the admin panel

// Owner, 2026-11-18: Desi Desserts is "12 ounces" for everything except these, which are 8 oz.
// Dishes with a size show it instead of "Serves N".
export const SIZE_BY_STALL = { "desi-desserts": "12 oz" };
export const SIZE_EXCEPTIONS = {
  "desi-desserts.apricot-delight": "8 oz",
  "desi-desserts.rasmalai": "8 oz",
  "desi-desserts.gulab-jamun": "8 oz",
  // Owner, 2026-11-18: no size for these two (not drinks); they show the description only.
  "desi-desserts.chocolate-chip-brownie": null,
  "desi-desserts.poornalu": null,
};

export const descriptions = {
  // ------------------------------------------------ PandemKodi Dhaba · Curry + Pulka Combos
  "pandemkodi-dhaba.fish-curry-with-fresh-live-pulka": "Spicy, tangy fish curry with fresh live pulka off the tawa.",
  "pandemkodi-dhaba.mutton-curry-with-fresh-live-pulka": "Slow-cooked mutton curry in a rich, spiced gravy, with fresh live pulka.",
  "pandemkodi-dhaba.dhaba-chicken-curry-with-fresh-live-pulka": "Home-style dhaba chicken curry with fresh live pulka off the tawa.",
  "pandemkodi-dhaba.boiled-egg-curry-with-fresh-live-pulka": "Boiled eggs in a spiced onion-tomato gravy, with fresh live pulka.",
  "pandemkodi-dhaba.paneer-butter-masala-with-fresh-live-pulka": "Paneer in a creamy tomato-butter gravy, with fresh live pulka.",

  // ------------------------------------------------ Veg Appetizers
  "pandemkodi-dhaba.pepper-baby-corn-fry": "Crisp baby corn tossed with crushed black pepper and curry leaves.",
  "pandemkodi-dhaba.dragon-paneer": "Crispy paneer tossed in a fiery, sweet-spicy Indo-Chinese sauce.",
  "pandemkodi-dhaba.kaaram-paneer": "Paneer tossed in a hot Andhra-style red chilli masala.",
  "pandemkodi-dhaba.kaju-gobi": "Crispy cauliflower tossed with roasted cashews and spices.",
  "pandemkodi-dhaba.methi-paneer": "Paneer cooked with fenugreek leaves and warm spices.",

  // ------------------------------------------------ Non-Veg Appetizers
  "pandemkodi-dhaba.pandem-kodi-chicken-ghee-roast": "The house special: chicken roasted in ghee with a fiery red masala.",
  "pandemkodi-dhaba.dragon-chicken": "Crispy chicken strips tossed in a sweet, spicy Indo-Chinese sauce.",
  "pandemkodi-dhaba.devil-chicken": "Fried chicken tossed in a hot, tangy chilli sauce.",
  "pandemkodi-dhaba.shrimp-555": "Crispy fried shrimp tossed in a spicy, tangy masala.",
  "pandemkodi-dhaba.apollo-fish": "Hyderabad-style boneless fish fry tossed in a spicy yogurt-chilli masala.",
  "pandemkodi-dhaba.fish-daniya": "Fried fish tossed with fresh coriander and green chilli.",
  "pandemkodi-dhaba.tandoori-chicken": "Chicken marinated in yogurt and tandoori spices, then chargrilled.",

  // ------------------------------------------------ Veg Curries
  "pandemkodi-dhaba.kaju-tomato-curry": "Cashews simmered in a tangy, lightly spiced tomato gravy.",
  "pandemkodi-dhaba.jeedipappu-koora": "Andhra-style cashew curry in a rich, spiced gravy.",
  "pandemkodi-dhaba.dhaba-style-paneer-curry": "Paneer cooked dhaba-style in a robust onion-tomato masala.",
  "pandemkodi-dhaba.paneer-butter-masala": "Paneer in a creamy, mildly sweet tomato-butter gravy.",
  "pandemkodi-dhaba.paneer-tikka-masala": "Chargrilled paneer tikka in a smoky, spiced masala gravy.",

  // ------------------------------------------------ Non-Veg Curries
  "pandemkodi-dhaba.dhaba-chicken-curry": "Home-style chicken curry in a bold, rustic dhaba masala.",
  "pandemkodi-dhaba.afghani-chicken-curry": "Chicken in a mild, creamy white gravy with cashew and pepper.",
  "pandemkodi-dhaba.butter-chicken-curry": "Chicken in a smooth, buttery tomato gravy.",
  "pandemkodi-dhaba.chicken-tikka-masala": "Chargrilled chicken tikka in a spiced onion-tomato masala.",
  "pandemkodi-dhaba.andhra-chicken-curry": "Fiery Andhra-style chicken curry with red chilli and spices.",
  "pandemkodi-dhaba.prawns-curry": "Prawns simmered in a spicy, tangy coastal-style gravy.",

  // ------------------------------------------------ Egg Curries
  "pandemkodi-dhaba.egg-burji": "Scrambled eggs cooked with onion, tomato, green chilli and spices.",
  "pandemkodi-dhaba.egg-kheema-curry": "Minced boiled egg cooked in a spiced onion-tomato masala.",
  "pandemkodi-dhaba.boiled-egg-curry": "Boiled eggs in a spiced onion-tomato gravy.",
  "pandemkodi-dhaba.tomato-egg-curry": "Eggs simmered in a tangy, spiced tomato gravy.",

  // ------------------------------------------------ Fresh Live Pulka (menu: "Hot · Fresh · Soft", priced each)
  "pandemkodi-dhaba.fresh-live-pulka": "Hot, fresh and soft, made to order on the tawa. Priced each.",

  // ------------------------------------------------ Mandi
  "pandemkodi-dhaba.juicy-chicken-mandi": "Tender chicken on fragrant, mildly spiced mandi rice.",
  "pandemkodi-dhaba.pandem-kodi-spl-chicken-mandi": "The house special chicken mandi on fragrant mandi rice.",
  "pandemkodi-dhaba.juicy-paneer-mandi": "Paneer on fragrant, mildly spiced mandi rice.",

  // ------------------------------------------------ Pulav
  "pandemkodi-dhaba.pandem-kodi-spl-chicken-pulav": "The house special chicken pulav, cooked with fragrant rice and whole spices.",
  "pandemkodi-dhaba.chicken-ghee-roast-pulav": "Ghee roast chicken folded into fragrant spiced pulav rice.",
  "pandemkodi-dhaba.paneer-pulav": "Paneer cooked into fragrant spiced pulav rice.",

  // ------------------------------------------------ Desi Desserts · Faloodas
  "desi-desserts.royal-falooda": "Rose falooda with vermicelli, basil seeds, ice cream, nuts and a cherry.",
  "desi-desserts.mango-falooda": "Mango falooda with vermicelli, basil seeds, ice cream and fresh mango.",
  "desi-desserts.kesar-pista-falooda": "Saffron and pistachio falooda with vermicelli, basil seeds and ice cream.",
  "desi-desserts.special-falooda": "A loaded falooda with fruit, vermicelli, basil seeds and ice cream.",
  "desi-desserts.chikoo-falooda": "Chikoo (sapodilla) falooda with vermicelli, basil seeds and ice cream.",
  "desi-desserts.choco-caramel": "Chocolate and caramel falooda with vermicelli, ice cream and nuts.",

  // ------------------------------------------------ Milk, Shakes & Lassi
  "desi-desserts.rose-milk": "Chilled milk with rose syrup.",
  "desi-desserts.badam-milk": "Chilled almond milk with saffron and sliced almonds.",
  "desi-desserts.chikoo-shake": "Thick, chilled chikoo (sapodilla) milkshake.",
  "desi-desserts.mango-lassi": "Chilled yogurt blended with sweet mango.",

  // ------------------------------------------------ Desserts
  "desi-desserts.apricot-delight": "Layered dessert of apricot, cream and sponge.",
  "desi-desserts.chocolate-chip-brownie": "Warm chocolate chip brownie with a scoop of ice cream.",
  "desi-desserts.gulab-jamun": "Soft milk dumplings soaked in warm sugar syrup.",
  "desi-desserts.rasmalai": "Soft cheese dumplings in chilled saffron milk with pistachios.",
  "desi-desserts.poornalu": "Andhra sweet dumplings stuffed with chana dal and jaggery.",
};
