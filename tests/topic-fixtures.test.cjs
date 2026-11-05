/* Run with: node --test tests/topic-fixtures.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../tools/seed-topic-practice.js');
const sets = build();
const items = sets.flatMap(x => x.questions.map(q => ({set:x,q})));
test('contains 12 topics across 4 subjects and 180 questions', () => {
  assert.equal(sets.length,12);
  assert.equal(new Set(sets.map(t=>t.category)).size,4);
  assert.equal(items.length,180);
});
test('difficulty distribution is balanced', () => {
  for(const level of ['Foundation','Medium','Advanced'])
    assert.equal(items.filter(x=>x.q.difficulty===level).length,60);
  for (const topic of sets) assert.equal(topic.questions.length,15);
});
test('all questions have answer, distractors, explanation, topic and unique IDs', () => {
  assert.equal(new Set(items.map(x=>x.q.id)).size,items.length);
  for(const {set,q} of items){
    assert.equal(set.available,true);
    assert.equal(set.topicPracticeOnly,true);
    assert.deepEqual(set.examIds,['up-police']);
    assert.equal(q.subject,set.category);
    assert.ok(q.question.length>5);
    assert.ok(q.topic.length>2);
    assert.equal(q.options.length,4);
    assert.equal(new Set(q.options).size,4);
    assert.ok(Number.isInteger(q.correctOption));
    assert.ok(q.correctOption>=0 && q.correctOption<4);
    assert.ok(q.options[q.correctOption]);
    assert.ok(q.explanation.length>10);
    assert.equal(q.origin,'original-practice-question');
  }
});
test('fixture generator is deterministic for safe re-use', () => {
  assert.equal(JSON.stringify(build()),JSON.stringify(sets));
});
