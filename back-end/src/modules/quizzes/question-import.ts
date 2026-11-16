import { BadRequestException } from '@nestjs/common';

export function parseQuestions(text: string) {
  const questions: { q: string; options: string[]; ans: number }[] = [];
  let question = '';
  let options: string[] = [];

  function fail(message: string): never {
    throw new BadRequestException(`Question ${questions.length + 1}: ${message}`);
  }

  for (const raw of text.split(/\r\n|[\n\r\v\f]/)) {
    const line = raw.trim().replace(/[\t\u00a0]+/g, ' ');
    if (!line) continue;

    const start = line.match(/^(?:(?:question|q)\s*\d*\s*[:.)-]|\d+[.)])\s*(.*)$/i);
    const option = line.match(/^([A-F])[.):]\s*(.+)$/i);
    const answer = line.match(/^(?:correct\s+answer|answer|correct)\s*:\s*([A-F])(?:[.)]?\s*)$/i);
    if (start) {
      if (question || options.length) fail('add an Answer: A–F line before starting the next question.');
      if (!start[1]) fail('enter the question text after its number.');
      question = start[1];
    } else if (option) {
      if (!question) fail('start with a numbered question, for example 1. What is an index?');
      if (option[1].toUpperCase().charCodeAt(0) !== 65 + options.length) fail('label the options A, B, C and so on in order.');
      options.push(option[2]);
    } else if (answer) {
      const ans = answer[1].toUpperCase().charCodeAt(0) - 65;
      if (!question || options.length < 2 || ans >= options.length) fail('include at least two options and select an existing option.');
      questions.push({ q: question, options, ans });
      if (questions.length > 50) throw new BadRequestException('A quiz can have at most 50 questions.');
      question = '';
      options = [];
    } else if (/^(?:correct\s+answer|answer|correct)\s*:/i.test(line)) {
      fail('use Answer: followed by a single option letter.');
    } else if (options.length) {
      options[options.length - 1] += ' ' + line;
    } else if (question) {
      question += ' ' + line;
    } else {
      fail('start each question with a number and period.');
    }
  }

  if (question) fail('finish the question with an Answer: A–F line.');
  if (!questions.length) fail('include at least one complete question.');
  return questions;
}
