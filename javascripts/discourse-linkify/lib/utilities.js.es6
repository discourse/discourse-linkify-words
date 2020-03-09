const readInputList = function(action) {
  if (settings[action.inputListName].trim() === '') {
    return;
  }
  settings[action.inputListName].split('|').forEach(pair => {
    if (!pair.includes(',')) {
      return;
    }
    let split = pair.split(',');
    let value = split.pop().trim();
    // We want to allow commas in regexes
    let word = split.join(',').trim();
    if (value === '' || word === '') {
      return;
    }
    action.inputs[word] = value;
  });
}

// Detect this pattern: /regex/modifiers
const isInputRegex = function(input) {
  if (input[0] === '/' && input.split('/').length > 2)
    return true;
  else
    return false;
}

const escapeRegExp = function(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

const prepareRegex = function(input) {
  let leftWordBoundary = "(\\s|[:.;,!?…\\([{]|^)";
  let rightWordBoundary = "(?=[:.;,!?…\\]})]|\\s|$)";
  let wordOrRegex, modifier, regex;
  if (isInputRegex(input)) {
    let tmp = input.split('/');
    modifier = tmp.pop();
    wordOrRegex = tmp.slice(1).join('/');
    // Allow only "i" modifier for now, global modifier is implicit
    if (modifier.includes('i')) {
      modifier = 'ig';
    } else {
      modifier = 'g';
    }
  } else {
    // Input is a case-insensitive WORD
    // Autolink only first occurence of the word in paragraph,
    // i.e. do not use global modifier here
    modifier = 'i';
    wordOrRegex = escapeRegExp(input);
  }
  try {
    regex = new RegExp(leftWordBoundary + '(' + wordOrRegex + ')' + rightWordBoundary, modifier);
  }
  catch(err) {
    console.log("ERROR from auto-linkify theme: Invalid input:");
    console.log(word);
    console.log(err.message);
    return;
  }
  return regex;
}

const executeRegex = function(regex, str, value, matches) {
  if (!(regex instanceof RegExp)) {
    return;
  }
  let match = regex.exec(str);
  if (match === null) {
    return;
  }
  do {
    // This is ugly, but we need the matched word and corresponding value together
    match.value = value;
    matches.push(match);
  }
  while (regex.global && (match = regex.exec(str)) !== null);
}

const replaceCapturedVariables = function(input, match) {
  // Did we capture user defined variables?
  // By default, we capture 2 vars: left boundary and the regex itself
  if (match.length <= 3)
    return input
  let captured = match.slice(3, match.length);
  let replaced = input;
  for (let i = captured.length; i > 0; i--) {
    let re = new RegExp("\\$" + i.toString(), "");
    replaced = replaced.replace(re, captured[i-1]);
  }
  return replaced;
}

const modifyText = function(text, action) {
  const words = action.inputs;
  let inputRegexes = Object.keys(words).filter(isInputRegex);
  // sort words longest first
  let sortedWords = Object.keys(words)
                    .filter(x => !isInputRegex(x))
                    .sort((x,y) => y.length - x.length);
  // First match regexes in the original order, then words longest first
  let keys = inputRegexes.concat(sortedWords);
  let matches = [];
  for (let i = 0; i < keys.length; i++) {
    let word = keys[i];
    let value = words[word];
    let regex = prepareRegex(word);
    executeRegex(regex, text.data, value, matches);
  }
  // Sort matches according to index, descending order
  // Got to work backwards not to muck up string
  const sortedMatches = matches.sort((m, n) => n.index - m.index);
  for (let i = 0; i < sortedMatches.length; i++) {
    let match = sortedMatches[i];
    let matchedLeftBoundary = match[1];
    let matchedWord = match[2];
    let value = replaceCapturedVariables(match.value, match);
    // We need to protect against multiple matches of the same word or phrase
    if (match.index + matchedLeftBoundary.length + matchedWord.length > text.data.length) {
      continue;
    }
    text.splitText(match.index + matchedLeftBoundary.length);
    text.nextSibling.splitText(matchedWord.length);
    text.parentNode.replaceChild(action.createNode(matchedWord, value), text.nextSibling);
  }
}

const isSkippedClass = function(classes, skipClasses) {
  // Return true if at least one of the classes should be skipped
  return classes && classes.split(" ").some(cls => cls in skipClasses);
}

const traverseNodes = function(elem, action, skipTags, skipClasses) {
  // work backwards so changes do not break iteration
  for(let i = elem.childNodes.length - 1; i >=0; i--) {
    let child = elem.childNodes[i];
    if (child.nodeType === 1) {
      let tag = child.nodeName.toLowerCase();
      let cls = child.getAttribute("class");
      if (!(tag in skipTags) && !isSkippedClass(cls, skipClasses)) {
        traverseNodes(child, action, skipTags, skipClasses);
      }
    } else if (child.nodeType === 3) {
      modifyText(child, action);
    }
  }
}

export {readInputList, traverseNodes}
