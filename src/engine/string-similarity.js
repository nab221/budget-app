import stringSimilarity from 'string-similarity';

/**
 * Compares two strings and returns a similarity score between 0 and 1.
 * Uses Dice's Coefficient (default in string-similarity).
 * 
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} 0-1 similarity score
 */
export function compareStrings(str1, str2) {
  if (!str1 || !str2) return 0;
  return stringSimilarity.compareTwoStrings(str1.toLowerCase(), str2.toLowerCase());
}

/**
 * Finds the best match for a string from an array of target strings.
 * 
 * @param {string} mainString 
 * @param {string[]} targetStrings 
 * @returns {object} { target, rating }
 */
export function findBestMatch(mainString, targetStrings) {
  if (!mainString || !targetStrings || targetStrings.length === 0) {
    return { target: null, rating: 0 };
  }
  const matches = stringSimilarity.findBestMatch(mainString.toLowerCase(), targetStrings.map(s => s.toLowerCase()));
  return matches.bestMatch;
}
