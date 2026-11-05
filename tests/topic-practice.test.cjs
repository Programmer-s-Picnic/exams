/* Run: node --test tests/topic-practice.test.cjs
 * Pure eligibility tests; production auth/database verification is separate.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/topic-practice.js','utf8'),context);
const bank = context.window.TopicPractice.bank;
const eligible = {
  id:'approved',title:'Published topic practice',available:true,type:'practice',
  audience:'student',examIds:['exam-a'],category:'Mathematics',difficulty:'Medium',
  questions:[
    {id:'q1',topic:'Algebra',question:'2+2?',options:['3','4'],correctOption:1,explanation:'Sum is 4.'},
    {id:'bad',topic:'Algebra',question:' ',options:['A','B'],correctOption:0}
  ]
};
function app(tests){ return {tests}; }
test('published practice questions are selectable with subject, topic and difficulty',()=>{
  const entries=bank(app([eligible]),'exam-a');
  assert.equal(entries.length,1);
  assert.equal(entries[0].subject,'Mathematics');
  assert.equal(entries[0].topic,'Algebra');
  assert.equal(entries[0].difficulty,'Medium');
});
test('guest diagnostics and logged-in diagnostics are excluded',()=>{
  const guest={...eligible,id:'guest',type:'diagnostic',audience:'guest'};
  const diagnostic={...eligible,id:'student-diagnostic',type:'diagnostic'};
  assert.equal(bank(app([guest,diagnostic]),'exam-a').length,0);
});
test('unpublished tests, wrong exams, invalid questions are excluded',()=>{
  assert.equal(bank(app([{...eligible,available:false}]),'exam-a').length,0);
  assert.equal(bank(app([eligible]),'other-exam').length,0);
  assert.equal(bank(app([{...eligible,questions:[eligible.questions[1]]}]),'exam-a').length,0);
});
test('the source questions are not mutated by question-bank extraction',()=>{
  const original=JSON.stringify(eligible);
  bank(app([eligible]),'exam-a');
  assert.equal(JSON.stringify(eligible),original);
});
