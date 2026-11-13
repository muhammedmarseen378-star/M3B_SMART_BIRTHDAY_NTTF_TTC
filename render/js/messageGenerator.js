// Predefined Personalized Birthday Message Templates Engine

const TODAY_CELEBRATION_TEMPLATES = [
  "Happy Birthday, {name}! 🎉 May this special milestone bring you limitless happiness, boundless inspiration, and radiant success in all your journeys. Have a truly unforgettable day!",
  "Warmest birthday congratulations, {name}! 🌟 Wishing you an extraordinary year filled with new breakthroughs, health, prosperity, and cherished moments with those you love.",
  "Dearest {name}, on your birthday today, may every dream you hold take flight! 🎂 Here is to celebrating your wonderful presence and looking forward to another year of brilliance.",
  "Happy Birthday to you, {name}! 🚀 May your day be illuminated with joy, heartfelt laughter, and the warmth of great friendships. Enjoy every minute of your celebration!",
  "Heartfelt birthday greetings, {name}! 🎈 May this new chapter bring you peace of mind, towering achievements, and boundless positive energy. Have a fantastic birthday!",
  "Cheers to another remarkable year, {name}! 🥂 May your path ahead be filled with shining opportunities, wisdom, and triumphant milestones. Happy Birthday!",
  "Wishing {name} the happiest of birthdays today! ✨ May the year ahead exceed your highest expectations and reward your dedication with grand success.",
  "Happy Birthday, {name}! 🎊 Today we celebrate you—a remarkable individual whose journey continues to inspire everyone around. May your celebration be as vibrant as you are!",
  "Sending warmest birthday blessings to {name}! 🎂 May your special day be wrapped in joy, filled with laughter, and crowned with abundant good fortune.",
  "Happy Birthday, {name}! 💫 May today mark the beginning of your most prosperous, rewarding, and fulfilling adventure yet. Celebrate in style!"
];

const UPCOMING_WISH_TEMPLATES = [
  "Upcoming birthday alert for {name}! 🌟 Turning {nextAge} on {nextDate} ({weekday}). May the days leading to your celebration be filled with anticipation, energy, and joy!",
  "Counting down the days to celebrate {name}! 🚀 On {nextDate}, a brilliant new milestone begins. Get ready for an incredible year ahead!",
  "Looking forward to your special day, {name}! 🎂 In just {daysLeft} days, on {nextDate}, we will be cheering for another year of your remarkable journey.",
  "A wonderful birthday is on the horizon for {name}! 🎈 Marking {nextDate} on the calendar with excitement and best wishes for the great year awaiting you.",
  "Warmest upcoming birthday greetings, {name}! ✨ May your next year of life, beginning {nextDate}, be defined by bold strides, deep peace, and extraordinary triumphs.",
  "Anticipating a glorious celebration for {name}! 🎊 Just {daysLeft} days until your birthday on {weekday}, {nextDate}. May this upcoming chapter surpass all previous ones!",
  "The countdown is on for {name}! 💫 Approaching {nextDate} with great hope and enthusiasm. Wishing you an inspiring season ahead as you turn {nextAge}.",
  "Excited for your milestone, {name}! 🌟 {nextDate} will be a day to honor your talents, warmth, and achievements. Wishing you strength and joy on the road ahead."
];

function stringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generatePersonalizedMessage(person) {
  if (!person) return '';

  const name = person.name || 'Friend';
  const isToday = person.isToday;
  const hash = stringHash(name + (person.id || ''));

  if (isToday) {
    const templateIndex = hash % TODAY_CELEBRATION_TEMPLATES.length;
    let template = TODAY_CELEBRATION_TEMPLATES[templateIndex];
    return template.replace(/\{name\}/g, name);
  } else {
    const templateIndex = hash % UPCOMING_WISH_TEMPLATES.length;
    let template = UPCOMING_WISH_TEMPLATES[templateIndex];

    const nextAge = person.turningAge ? `age ${person.turningAge}` : 'your next milestone';
    const nextDate = person.nextBirthdayDate || 'soon';
    const weekday = person.nextBirthdayWeekday || 'your special day';
    const daysLeft = person.daysRemaining !== undefined ? person.daysRemaining : 'a few';

    return template
      .replace(/\{name\}/g, name)
      .replace(/\{nextAge\}/g, nextAge)
      .replace(/\{nextDate\}/g, nextDate)
      .replace(/\{weekday\}/g, weekday)
      .replace(/\{daysLeft\}/g, daysLeft);
  }
}
