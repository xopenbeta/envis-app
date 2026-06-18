
export function isSubstr(str: string, sub: string) {
  let res = false;
  let i = 0;
  let j = 0;
  if (str.length === 0 || sub.length === 0) {
    res = false;
  }
  while (i < str.length && j < sub.length) {
    if (str[i] === sub[j]) {
      i += 1;
      j += 1;
    } else {
      i += 1;
    }
  }
  if (j === sub.length) { 
    res = true;
  }
  return res;
}
