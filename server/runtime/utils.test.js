const utils = require('./utils');

describe('Utils', () => {
  describe('isNullOrUndefined', () => {
    test('should return true for null', () => {
      expect(utils.isNullOrUndefined(null)).toBe(true);
    });

    test('should return true for undefined', () => {
      expect(utils.isNullOrUndefined(undefined)).toBe(true);
    });

    test('should return false for a string', () => {
      expect(utils.isNullOrUndefined('test')).toBe(false);
    });

    test('should return false for a number', () => {
      expect(utils.isNullOrUndefined(123)).toBe(false);
    });

    test('should return false for an object', () => {
      expect(utils.isNullOrUndefined({})).toBe(false);
    });

    test('should return false for an empty string', () => {
      expect(utils.isNullOrUndefined('')).toBe(false);
    });

    test('should return false for zero', () => {
      expect(utils.isNullOrUndefined(0)).toBe(false);
    });

    test('should return false for boolean true', () => {
      expect(utils.isNullOrUndefined(true)).toBe(false);
    });

    test('should return false for boolean false', () => {
      expect(utils.isNullOrUndefined(false)).toBe(false);
    });
  });

  describe('isEmptyObject', () => {
    test('should return true for an empty object', () => {
      expect(utils.isEmptyObject({})).toBe(true);
    });
    test('should return false for a non-empty object', () => {
      expect(utils.isEmptyObject({ a: 1 })).toBe(false);
    });
    test('should return false for null', () => {
      expect(utils.isEmptyObject(null)).toBe(false);
    });
    test('should return false for undefined', () => {
      expect(utils.isEmptyObject(undefined)).toBe(false);
    });
    test('should return false for array', () => {
      expect(utils.isEmptyObject([])).toBe(false);
    });
  });

  describe('isNumber', () => {
    test('should return true for integers', () => {
      expect(utils.isNumber(123)).toBe(true);
      expect(utils.isNumber(0)).toBe(true);
      expect(utils.isNumber(-10)).toBe(true);
    });
    test('should return true for floating point numbers', () => {
      expect(utils.isNumber(123.45)).toBe(true);
      expect(utils.isNumber(0.0)).toBe(true);
    });
    test('should return false for NaN', () => {
      expect(utils.isNumber(NaN)).toBe(false);
    });
    test('should return false for strings', () => {
      expect(utils.isNumber('123')).toBe(false);
    });
    test('should return false for null or undefined', () => {
      expect(utils.isNumber(null)).toBe(false);
      expect(utils.isNumber(undefined)).toBe(false);
    });
  });

  describe('isFloat', () => {
    test('should return true for float numbers', () => {
      expect(utils.isFloat(1.23)).toBe(true);
      expect(utils.isFloat(-0.5)).toBe(true);
    });
    test('should return false for integers', () => {
      expect(utils.isFloat(10)).toBe(false);
      expect(utils.isFloat(0)).toBe(false);
    });
     test('should return false for NaN', () => {
      expect(utils.isFloat(NaN)).toBe(false);
    });
    test('should return false for strings', () => {
      expect(utils.isFloat('1.23')).toBe(false);
    });
  });

  describe('isValidRange', () => {
    test('should return true for valid number ranges', () => {
      expect(utils.isValidRange(1, 10)).toBe(true);
      expect(utils.isValidRange(0, 0)).toBe(true);
      expect(utils.isValidRange(-5, 5)).toBe(true);
      expect(utils.isValidRange(10.5, 20.5)).toBe(true);
    });
    test('should return false if min is not a number', () => {
      expect(utils.isValidRange('1', 10)).toBe(false);
      expect(utils.isValidRange(null, 10)).toBe(false);
    });
    test('should return false if max is not a number', () => {
      expect(utils.isValidRange(1, '10')).toBe(false);
      expect(utils.isValidRange(1, undefined)).toBe(false);
    });
    // Note: The function does not check if min <= max. It only checks if they are numbers.
    // test('should return true even if min > max, as it only checks type', () => {
    //   expect(utils.isValidRange(10, 1)).toBe(true);
    // });
  });

  describe('dayOfYear', () => {
    test('should return correct day of year for given dates', () => {
      expect(utils.dayOfYear(new Date(2023, 0, 1))).toBe(1); // Jan 1
      expect(utils.dayOfYear(new Date(2023, 1, 10))).toBe(41); // Feb 10
      expect(utils.dayOfYear(new Date(2023, 11, 31))).toBe(365); // Dec 31
    });
    test('should return correct day of year for leap year', () => {
      expect(utils.dayOfYear(new Date(2024, 2, 1))).toBe(61); // Mar 1 in a leap year
      expect(utils.dayOfYear(new Date(2024, 11, 31))).toBe(366); // Dec 31 in a leap year
    });
    test('should return -1 for invalid date input', () => {
      expect(utils.dayOfYear(null)).toBe(-1);
      expect(utils.dayOfYear(undefined)).toBe(-1);
    });
  });

  describe('getDate', () => {
    test('should format date correctly', () => {
      const date = new Date(2023, 0, 5, 7, 8, 9); // Month is 0-indexed
      // Expected: 2023-01-05_07-08-09
      expect(utils.getDate(date)).toBe('2023-01-05_07-08-09');
    });
    test('should pad single digit month, day, hour, minute, second', () => {
      const date = new Date(2023, 0, 1, 1, 2, 3);
      expect(utils.getDate(date)).toBe('2023-01-01_01-02-03');
    });
  });

  describe('getFormatDate', () => {
    const date = new Date(2023, 0, 5, 7, 8, 9); // Month is 0-indexed
    test('should format date correctly with default format (dd/mm/yyyy HH:MM:SS)', () => {
      expect(utils.getFormatDate(date)).toBe('05/01/2023 07:08:09');
    });
    test('should format date correctly with ymd format', () => {
      expect(utils.getFormatDate(date, 'ymd')).toBe('2023/01/05/ 07:08:09');
    });
    test('should pad single digits for default format', () => {
      const dateSingle = new Date(2023, 0, 1, 1, 2, 3);
      expect(utils.getFormatDate(dateSingle)).toBe('01/01/2023 01:02:03');
    });
    test('should pad single digits for ymd format', () => {
      const dateSingle = new Date(2023, 0, 1, 1, 2, 3);
      expect(utils.getFormatDate(dateSingle, 'ymd')).toBe('2023/01/01/ 01:02:03');
    });
  });
});
