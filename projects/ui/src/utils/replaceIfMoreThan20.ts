export const replaceIfMoreThan20 = (
  str: string,
  substring: string,
  newString: string,
  max: number,
): string => {
  const regex = new RegExp(substring, "g");
  const count = (str.match(regex) || []).length;

  if (count > max) {
    const replaceCount = count - max;
    let replacedCount = 0;

    const occurrences: number[] = [];
    const findRegex = new RegExp(substring, "g");
    let match: RegExpExecArray | null = findRegex.exec(str);
    while (match !== null) {
      occurrences.push(match.index);
      match = findRegex.exec(str);
    }

    occurrences.sort((a, b) => b - a);

    let result = str;
    for (const index of occurrences) {
      if (replacedCount >= replaceCount) break;
      result = result.substring(0, index) + newString + result.substring(index + substring.length);
      replacedCount++;
    }
    return result;
  } else {
    return str;
  }
};
