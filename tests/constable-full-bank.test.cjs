// Run: node --test tests/constable-full-bank.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const old=require('../tools/seed-topic-practice.js').build();
const newer=require('../tools/expand-constable-bank.js').build();
const mocks=require('../tools/build-constable-mocks.js').build([...old,...newer]);
const topicSets=[...old,...newer];
const questions=topicSets.flatMap(t=>t.questions);
test('480 original topic questions in 32 sets and 4 subjects',()=>{
 assert.equal(topicSets.length,32);assert.equal(questions.length,480);
 assert.equal(new Set(topicSets.map(t=>t.category)).size,4);
 assert.equal(new Set(questions.map(q=>q.id)).size,480);
 assert.equal(new Set(topicSets.map(t=>t.questions[0].topic)).size,32);
 for(const level of ['Foundation','Medium','Advanced'])
   assert.equal(questions.filter(q=>q.difficulty===level).length,160);
});
test('all questions valid, attributed, explained and have four distinct choices',()=>{
 for(const test of topicSets){
  assert.equal(test.topicPracticeOnly,true);
  assert.equal(test.available,true);
  assert.deepEqual(test.examIds,['up-police']);
  for(const q of test.questions){
   assert.ok(q.question?.trim());
   assert.equal(q.options.length,4);
   assert.equal(new Set(q.options).size,4);
   assert.ok(Number.isInteger(q.correctOption)&&q.correctOption>=0&&q.correctOption<4);
   assert.ok(q.options[q.correctOption].trim());
   assert.ok(q.explanation.length>=10);
   assert.equal(q.origin,'original-practice-question');
  }
 }
});
test('three original practice mocks contain 150 questions, 300 marks and 120 minutes',()=>{
 assert.equal(mocks.length,3);
 for(const mock of mocks){
  assert.equal(mock.fullMock,true);
  assert.equal(mock.available,true);
  assert.equal(mock.questions.length,150);
  assert.equal(mock.totalMarks,300);
  assert.equal(mock.timing.totalSeconds,7200);
  assert.equal(mock.marking.correct,2);
  assert.equal(mock.marking.incorrect,0);
  assert.equal(mock.patternStatus,'original-editorial-full-length-practice');
  assert.deepEqual(Object.values(mock.subjectQuestionCounts).sort((a,b)=>a-b),[37,37,38,38]);
  assert.ok(mock.questions.every(q=>q.marks===2));
 }
});
test('full mocks are disjoint and do not manufacture official PYQs',()=>{
 const all=mocks.flatMap(m=>m.questions);
 assert.equal(all.length,450);
 assert.equal(new Set(all.map(q=>q.sourceQuestionId)).size,450);
 assert.ok(all.every(q=>q.origin==='original-practice-question'));
 assert.ok(mocks.every(m=>/NOT an official or previous-year paper/.test(m.description)));
});
