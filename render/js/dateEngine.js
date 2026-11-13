// Centralized Date and Age Calculation Engine

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export class DateEngine {
  constructor(referenceDate = new Date()) {
    this.refDate = new Date(referenceDate);
  }

  setReferenceDate(newDate) {
    this.refDate = new Date(newDate);
  }

  getTodayComponents() {
    return {
      year: this.refDate.getFullYear(),
      month: this.refDate.getMonth() + 1, // 1 - 12
      day: this.refDate.getDate(),
      weekday: WEEKDAYS[this.refDate.getDay()]
    };
  }

  isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  // Resolves the effective day and month for a target year
  // (specifically mapping Feb 29 to Feb 28 in non-leap years)
  getEffectiveBirthday(birthMonth, birthDay, targetYear) {
    if (birthMonth === 2 && birthDay === 29) {
      if (!this.isLeapYear(targetYear)) {
        return { month: 2, day: 28, isLeapShifted: true };
      }
    }
    return { month: birthMonth, day: birthDay, isLeapShifted: false };
  }

  // Central evaluation for a single person record
  evaluatePerson(person) {
    if (!person.dateValid || !person.birthMonth || !person.birthDay) {
      return {
        ...person,
        isToday: false,
        daysRemaining: 9999,
        currentAge: null,
        turningAge: null,
        nextBirthdayDate: null,
        nextBirthdayWeekday: null,
        status: 'INCOMPLETE_DATA',
        formattedDob: person.rawDob || 'Unknown',
        displayStatus: 'Date Missing / Incomplete'
      };
    }

    const today = this.getTodayComponents();
    const bMonth = person.birthMonth;
    const bDay = person.birthDay;
    const bYear = person.birthYear;

    // Check if TODAY is their birthday (only compare month and day)
    let isToday = false;
    if (bMonth === 2 && bDay === 29 && !this.isLeapYear(today.year)) {
      isToday = (today.month === 2 && today.day === 28);
    } else {
      isToday = (today.month === bMonth && today.day === bDay);
    }

    // Determine current age
    let currentAge = null;
    let turningAge = null;
    let ageUnavailable = false;

    if (bYear && bYear <= today.year) {
      // Normal age calculation
      let age = today.year - bYear;
      const effectiveThisYear = this.getEffectiveBirthday(bMonth, bDay, today.year);
      const hasPassedThisYear = (today.month > effectiveThisYear.month) || 
        (today.month === effectiveThisYear.month && today.day > effectiveThisYear.day);

      if (hasPassedThisYear) {
        currentAge = age;
        turningAge = age + 1;
      } else if (isToday) {
        currentAge = age;
        turningAge = age;
      } else {
        currentAge = Math.max(0, age - 1);
        turningAge = age;
      }
    } else if (bYear && bYear > today.year) {
      // Birth year is in the future
      ageUnavailable = true;
    } else {
      // Birth year not provided
      ageUnavailable = true;
    }

    // Determine Next Birthday Occurrence
    let nextBdayYear = today.year;
    const effectiveThisYear = this.getEffectiveBirthday(bMonth, bDay, today.year);
    const thisYearOccurrence = new Date(today.year, effectiveThisYear.month - 1, effectiveThisYear.day);
    
    // Normalize today without time
    const todayZero = new Date(today.year, today.month - 1, today.day);

    let nextBdayDate;
    if (isToday) {
      nextBdayDate = thisYearOccurrence;
    } else if (thisYearOccurrence < todayZero) {
      // Birthday already passed this year -> next one is next year!
      nextBdayYear = today.year + 1;
      const effectiveNextYear = this.getEffectiveBirthday(bMonth, bDay, nextBdayYear);
      nextBdayDate = new Date(nextBdayYear, effectiveNextYear.month - 1, effectiveNextYear.day);
    } else {
      nextBdayDate = thisYearOccurrence;
    }

    // Calculate exact calendar days remaining
    const diffTime = nextBdayDate.getTime() - todayZero.getTime();
    const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // Next birthday weekday
    const nextBirthdayWeekday = WEEKDAYS[nextBdayDate.getDay()];

    // Formatted strings
    const bMonthName = MONTH_NAMES[bMonth - 1];
    const bMonthShort = MONTH_SHORT_NAMES[bMonth - 1];
    
    let formattedDob = `${bDay} ${bMonthName}`;
    if (bYear) {
      formattedDob += ` ${bYear}`;
    }

    const nextBdayFormatted = `${nextBdayDate.getDate()} ${MONTH_NAMES[nextBdayDate.getMonth()]} ${nextBdayDate.getFullYear()}`;

    // Status description
    let status = 'UPCOMING';
    let displayStatus = 'Upcoming Birthday';
    if (isToday) {
      status = 'TODAY';
      displayStatus = 'TODAY IS YOUR BIRTHDAY!';
    } else if (daysRemaining === 1) {
      displayStatus = 'Tomorrow!';
    } else if (daysRemaining <= 7) {
      displayStatus = `In ${daysRemaining} days (This Week)`;
    } else if (daysRemaining <= 30) {
      displayStatus = `In ${daysRemaining} days`;
    }

    return {
      ...person,
      isToday,
      daysRemaining: isToday ? 0 : daysRemaining,
      currentAge: ageUnavailable ? null : currentAge,
      turningAge: ageUnavailable ? null : (isToday ? currentAge : turningAge),
      ageUnavailable,
      nextBirthdayDate: nextBdayFormatted,
      nextBirthdayRaw: nextBdayDate,
      nextBirthdayWeekday,
      nextBirthdayYear: nextBdayDate.getFullYear(),
      birthMonthName: bMonthName,
      birthMonthShort: bMonthShort,
      status,
      displayStatus,
      formattedDob
    };
  }

  // Evaluate entire dataset
  evaluateAll(peopleList) {
    return peopleList.map(p => this.evaluatePerson(p));
  }
}
