(function (root) {
  function build(result, test, syllabus) {
    const groups = { subjects: {}, topics: {} };
    const marking = result.marking || test.marking || {};
    const custom = result.markingMode === 'custom';
    const questions = result.questions || test.questions;
    const add = (bucket, key, label, subjectId, earned, maximum, status) => {
      const row = bucket[key] ||= { id: key, label, subjectId, earned: 0, maximum: 0, correct: 0, incorrect: 0, unanswered: 0, total: 0 };
      row.earned += earned; row.maximum += maximum; row[status] += 1; row.total += 1;
    };
    questions.forEach((question, index) => {
      const answer = result.answers[index];
      const status = answer == null ? 'unanswered' : answer === question.correctOption ? 'correct' : 'incorrect';
      const maximum = Number(custom ? marking.correct : question.marks ?? marking.correct ?? 1);
      const earned = status === 'correct' ? maximum : Number(status === 'incorrect' ? (marking.incorrect ?? -Number(test.negativeMarking || 0)) : (marking.unanswered ?? 0));
      const subjectId = question.subjectId || question.topic;
      const section = syllabus?.sections?.find(item => item.id === subjectId);
      const label = section?.name || question.subject || question.topic;
      const topicId = question.topicId || question.topic;
      add(groups.subjects, subjectId, label, subjectId, earned, maximum, status);
      add(groups.topics, `${subjectId}/${topicId}`, question.topicName || question.topic, subjectId, earned, maximum, status);
    });
    const subjects = Object.values(groups.subjects);
    const topics = Object.values(groups.topics);
    const attempted = result.correct + result.incorrect;
    const accuracy = attempted ? Math.round(result.correct / attempted * 100) : null;
    const rate = row => row.correct / row.total;
    const rank = row => (row.maximum - row.earned) + row.unanswered * 0.5;
    const strengths = topics.filter(row => row.total >= 3 && rate(row) >= 0.75).sort((a, b) => rate(b) - rate(a));
    const weakTopics = topics.filter(row => row.total >= 3 && rate(row) < 0.6).sort((a, b) => rank(b) - rank(a));
    const weakSubjects = subjects.filter(row => row.total >= 3 && rate(row) < 0.6).sort((a, b) => rank(b) - rank(a));
    const focus = [...weakTopics.map(row => ({ ...row, kind: 'topic' })), ...weakSubjects.map(row => ({ ...row, kind: 'subject' }))]
      .sort((a, b) => rank(b) - rank(a)).slice(0, 3);
    return { subjects, topics, accuracy, strengths, focus, needsAssessment: topics.filter(row => row.total < 3), attempted };
  }
  root.DiagnosticReport = { build };
  if (typeof module !== 'undefined') module.exports = { build };
}(typeof window !== 'undefined' ? window : globalThis));
