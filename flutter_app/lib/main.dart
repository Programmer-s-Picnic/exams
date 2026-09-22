import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

const apiRoot =
    'https://raw.githubusercontent.com/Programmer-s-Picnic/examsdata/main';
const blue = Color(0xFF2457D6);
const ink = Color(0xFF17223B);
const pale = Color(0xFFF4F8FF);

void main() => runApp(const HimanshuExamsApp());

class Api {
  static Future<Map<String, dynamic>> get(String path) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15);
    try {
      final request = await client.getUrl(Uri.parse('$apiRoot/$path'));
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      final response = await request.close().timeout(
        const Duration(seconds: 20),
      );
      if (response.statusCode != 200)
        throw HttpException('HTTP ${response.statusCode}');
      return jsonDecode(await utf8.decoder.bind(response).join())
          as Map<String, dynamic>;
    } finally {
      client.close();
    }
  }
}

class HimanshuExamsApp extends StatelessWidget {
  const HimanshuExamsApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Himanshu Exams',
    theme: ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: pale,
      colorScheme: ColorScheme.fromSeed(
        seedColor: blue,
        primary: blue,
        surface: Colors.white,
      ),
      fontFamily: 'sans-serif',
      cardTheme: const CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    home: const LoginScreen(),
  );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final id = TextEditingController(text: 'student@example.com');
  final password = TextEditingController(text: 'demo123');
  bool hidden = true, loading = false;
  String? error;

  Future<void> login() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await Api.get('users-registered.json');
      final users = List<Map<String, dynamic>>.from(data['users']);
      final loginId = id.text.trim().toLowerCase();
      Map<String, dynamic>? user;
      for (final candidate in users) {
        final ids = [
          candidate['email'],
          candidate['mobile'],
          candidate['studentId'],
        ].map((v) => '$v'.toLowerCase());
        if (ids.contains(loginId)) {
          user = candidate;
          break;
        }
      }
      if (user == null ||
          (loginId == 'student@example.com' && password.text != 'demo123')) {
        throw const FormatException(
          'The login details do not match our records.',
        );
      }
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => Dashboard(user: user!)),
      );
    } catch (e) {
      setState(
        () => error = e is FormatException
            ? e.message
            : 'Could not connect. Check your internet and try again.',
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Center(child: BrandMark(size: 72)),
                const SizedBox(height: 20),
                const Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Continue your preparation with tests, feedback and a clear plan.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF63708A), height: 1.5),
                ),
                const SizedBox(height: 30),
                TextField(
                  controller: id,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number or email',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: password,
                  obscureText: hidden,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => hidden = !hidden),
                      icon: Icon(
                        hidden
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                    ),
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: loading ? null : login,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                  ),
                  child: Text(loading ? 'Signing in…' : 'Sign in securely'),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF1FF),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text(
                    'Demo account\nstudent@example.com  •  Password: demo123',
                    textAlign: TextAlign.center,
                    style: TextStyle(height: 1.5, color: ink),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class Dashboard extends StatefulWidget {
  final Map<String, dynamic> user;
  const Dashboard({super.key, required this.user});
  @override
  State<Dashboard> createState() => _DashboardState();
}

class _DashboardState extends State<Dashboard> {
  int tab = 0;
  late Future<List<dynamic>> data;
  @override
  void initState() {
    super.initState();
    data = Future.wait([Api.get('exams.json'), Api.get('tests.json')]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: Colors.white,
      title: const Row(
        children: [
          BrandMark(size: 38),
          SizedBox(width: 10),
          Text(
            'Himanshu Exams',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
          ),
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 14),
          child: CircleAvatar(child: Text('${widget.user['name']}'[0])),
        ),
      ],
    ),
    body: FutureBuilder<List<dynamic>>(
      future: data,
      builder: (context, snapshot) {
        if (snapshot.hasError)
          return ErrorView(
            onRetry: () => setState(
              () => data = Future.wait([
                Api.get('exams.json'),
                Api.get('tests.json'),
              ]),
            ),
          );
        if (!snapshot.hasData)
          return const Center(child: CircularProgressIndicator());
        final exams = List<Map<String, dynamic>>.from(
          snapshot.data![0]['exams'],
        );
        final tests = List<Map<String, dynamic>>.from(
          snapshot.data![1]['tests'],
        );
        return IndexedStack(
          index: tab,
          children: [
            HomeTab(user: widget.user, exams: exams, tests: tests),
            TestsTab(tests: tests),
            const ResultsTab(),
            ProfileTab(user: widget.user),
          ],
        );
      },
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (value) => setState(() => tab = value),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.quiz_outlined),
          selectedIcon: Icon(Icons.quiz),
          label: 'Tests',
        ),
        NavigationDestination(
          icon: Icon(Icons.insights_outlined),
          selectedIcon: Icon(Icons.insights),
          label: 'Results',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    ),
  );
}

class HomeTab extends StatelessWidget {
  final Map<String, dynamic> user;
  final List<Map<String, dynamic>> exams, tests;
  const HomeTab({
    super.key,
    required this.user,
    required this.exams,
    required this.tests,
  });
  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () async {},
    child: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Text(
          'Good day, ${'${user['name']}'.split(' ').first}',
          style: const TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        const Text(
          'Keep your preparation focused and measurable.',
          style: TextStyle(color: Color(0xFF63708A)),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF2457D6), Color(0xFF4F7DE8)],
            ),
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'TODAY’S PLAN',
                style: TextStyle(
                  color: Colors.white70,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Take a diagnostic test',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 5),
              const Text(
                'Build a baseline and discover the topics that need attention.',
                style: TextStyle(color: Colors.white, height: 1.4),
              ),
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: tests.isEmpty
                    ? null
                    : () => openTest(context, tests.first),
                child: const Text('Start now →'),
              ),
            ],
          ),
        ),
        const SectionTitle('Available tests'),
        ...tests.map((test) => TestCard(test: test)),
        const SectionTitle('Exam goals'),
        ...exams
            .take(4)
            .map(
              (exam) => CardBox(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.school_outlined, color: blue),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${exam['name']}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            '${exam['description']}',
                            style: const TextStyle(
                              color: Color(0xFF63708A),
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
      ],
    ),
  );
}

class TestsTab extends StatelessWidget {
  final List<Map<String, dynamic>> tests;
  const TestsTab({super.key, required this.tests});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(18),
    children: [
      const Text(
        'Practice tests',
        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: ink),
      ),
      const SizedBox(height: 6),
      const Text('Choose a test and your preferred timing and feedback mode.'),
      const SizedBox(height: 18),
      ...tests.map((test) => TestCard(test: test)),
    ],
  );
}

class TestCard extends StatelessWidget {
  final Map<String, dynamic> test;
  const TestCard({super.key, required this.test});
  @override
  Widget build(BuildContext context) => CardBox(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFEAF1FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.code, color: blue),
            ),
            const Spacer(),
            Chip(label: Text('${test['difficulty']}')),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          '${test['title']}',
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${test['description']}',
          style: const TextStyle(color: Color(0xFF63708A), height: 1.4),
        ),
        const SizedBox(height: 13),
        Text(
          '${(test['questions'] as List).length} questions  •  ${test['totalMarks']} marks  •  ${((test['timing']['totalSeconds'] as num) / 60).round()} min',
        ),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: () => openTest(context, test),
          child: const Text('View instructions'),
        ),
      ],
    ),
  );
}

void openTest(BuildContext context, Map<String, dynamic> test) {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => Instructions(test: test)),
  );
}

class Instructions extends StatefulWidget {
  final Map<String, dynamic> test;
  const Instructions({super.key, required this.test});
  @override
  State<Instructions> createState() => _InstructionsState();
}

class _InstructionsState extends State<Instructions> {
  String timing = 'total-timed', feedback = 'on-completion';
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Test instructions')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          '${widget.test['title']}',
          style: const TextStyle(
            fontSize: 27,
            fontWeight: FontWeight.w800,
            color: ink,
          ),
        ),
        const SizedBox(height: 10),
        Text('${widget.test['description']}'),
        const SectionTitle('Timing mode'),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'total-timed', label: Text('Total')),
            ButtonSegment(value: 'question-timed', label: Text('Per question')),
            ButtonSegment(value: 'untimed', label: Text('Untimed')),
          ],
          selected: {timing},
          onSelectionChanged: (v) => setState(() => timing = v.first),
        ),
        const SectionTitle('Answer feedback'),
        RadioListTile(
          value: 'on-completion',
          groupValue: feedback,
          title: const Text('After full test completion'),
          onChanged: (v) => setState(() => feedback = v!),
        ),
        RadioListTile(
          value: 'per-question',
          groupValue: feedback,
          title: const Text('After each question'),
          onChanged: (v) => setState(() => feedback = v!),
        ),
        const SizedBox(height: 15),
        FilledButton(
          onPressed: () => Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => TestScreen(
                test: widget.test,
                mode: timing,
                feedback: feedback,
              ),
            ),
          ),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
          child: const Text('Begin test'),
        ),
      ],
    ),
  );
}

class TestScreen extends StatefulWidget {
  final Map<String, dynamic> test;
  final String mode, feedback;
  const TestScreen({
    super.key,
    required this.test,
    required this.mode,
    required this.feedback,
  });
  @override
  State<TestScreen> createState() => _TestScreenState();
}

class _TestScreenState extends State<TestScreen> {
  int current = 0, seconds = 0;
  Timer? timer;
  late List<int?> answers;
  late List<bool> checked, review;
  List<Map<String, dynamic>> get questions =>
      List<Map<String, dynamic>>.from(widget.test['questions']);
  @override
  void initState() {
    super.initState();
    answers = List.filled(questions.length, null);
    checked = List.filled(questions.length, false);
    review = List.filled(questions.length, false);
    resetTimer();
  }

  void resetTimer() {
    timer?.cancel();
    seconds = widget.mode == 'total-timed'
        ? widget.test['timing']['totalSeconds']
        : widget.mode == 'question-timed'
        ? widget.test['timing']['questionSeconds']
        : 0;
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (widget.mode == 'untimed') {
          seconds++;
        } else if (seconds > 0) {
          seconds--;
        } else {
          next(auto: true);
        }
      });
    });
  }

  void next({bool auto = false}) {
    if (widget.feedback == 'per-question' && !checked[current] && !auto) {
      if (answers[current] == null) return;
      setState(() => checked[current] = true);
      return;
    }
    if (current == questions.length - 1 ||
        (auto && widget.mode == 'total-timed')) {
      finish();
      return;
    }
    setState(() {
      current++;
      checked[current] = false;
    });
    if (widget.mode == 'question-timed') resetTimer();
  }

  void finish() {
    timer?.cancel();
    int correct = 0;
    for (var i = 0; i < questions.length; i++) {
      if (answers[i] == questions[i]['correctOption']) correct++;
    }
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) =>
            ResultScreen(test: widget.test, answers: answers, correct: correct),
      ),
    );
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  String clock() =>
      '${widget.mode == 'untimed' ? 'Elapsed' : 'Remaining'} ${(seconds ~/ 60).toString().padLeft(2, '0')}:${(seconds % 60).toString().padLeft(2, '0')}';
  @override
  Widget build(BuildContext context) {
    final q = questions[current];
    final isChecked = checked[current];
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            onPressed: () => showDialog(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text('Exit test?'),
                content: const Text('Your current attempt will be closed.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Continue'),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.pop(context);
                    },
                    child: const Text('Exit'),
                  ),
                ],
              ),
            ),
            icon: const Icon(Icons.close),
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${widget.test['title']}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                'Question ${current + 1} of ${questions.length}',
                style: const TextStyle(fontSize: 12),
              ),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 15),
              child: Center(
                child: Text(
                  clock(),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            LinearProgressIndicator(value: (current + 1) / questions.length),
            const SizedBox(height: 24),
            Text(
              '${q['topic']}  •  ${q['marks'] ?? 1} mark',
              style: const TextStyle(color: blue, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            Text(
              '${q['question']}',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: ink,
                height: 1.3,
              ),
            ),
            if (q['code'] != null)
              Container(
                margin: const EdgeInsets.only(top: 14),
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: ink,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '${q['code']}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            const SizedBox(height: 18),
            ...List<String>.from(q['options']).asMap().entries.map((entry) {
              final correct = entry.key == q['correctOption'];
              final selected = answers[current] == entry.key;
              Color? color;
              if (isChecked && correct) color = Colors.green.shade50;
              if (isChecked && selected && !correct) color = Colors.red.shade50;
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                color: color,
                child: RadioListTile<int>(
                  value: entry.key,
                  groupValue: answers[current],
                  onChanged: isChecked
                      ? null
                      : (v) => setState(() => answers[current] = v),
                  title: Text(
                    '${String.fromCharCode(65 + entry.key)}.  ${entry.value}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              );
            }),
            if (isChecked)
              Container(
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: const Color(0xFFEAF1FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '${q['explanation']}',
                  style: const TextStyle(height: 1.45),
                ),
              ),
            const SizedBox(height: 15),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () =>
                      setState(() => review[current] = !review[current]),
                  icon: Icon(
                    review[current] ? Icons.bookmark : Icons.bookmark_border,
                  ),
                  label: const Text('Review'),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: next,
                  child: Text(
                    widget.feedback == 'per-question' && !isChecked
                        ? 'Check answer'
                        : current == questions.length - 1
                        ? 'Submit'
                        : 'Save & next',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ResultScreen extends StatelessWidget {
  final Map<String, dynamic> test;
  final List<int?> answers;
  final int correct;
  const ResultScreen({
    super.key,
    required this.test,
    required this.answers,
    required this.correct,
  });
  @override
  Widget build(BuildContext context) {
    final total = answers.length;
    final percent = (correct * 100 / total).round();
    return Scaffold(
      appBar: AppBar(title: const Text('Test result')),
      body: ListView(
        padding: const EdgeInsets.all(22),
        children: [
          Center(
            child: SizedBox(
              width: 160,
              height: 160,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox.expand(
                    child: CircularProgressIndicator(
                      value: percent / 100,
                      strokeWidth: 14,
                      backgroundColor: const Color(0xFFE4EAF5),
                    ),
                  ),
                  Text(
                    '$percent%',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: ink,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          Text(
            percent >= (test['passPercent'] ?? 40)
                ? 'Well done!'
                : 'Keep practising',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$correct correct • ${answers.where((a) => a != null).length} attempted • $total questions',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 25),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Back to dashboard'),
          ),
        ],
      ),
    );
  }
}

class ResultsTab extends StatelessWidget {
  const ResultsTab({super.key});
  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insights, size: 64, color: blue),
          SizedBox(height: 15),
          Text(
            'Your results will appear here',
            style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
          ),
          SizedBox(height: 8),
          Text(
            'Complete a test to begin tracking your progress.',
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
  );
}

class ProfileTab extends StatelessWidget {
  final Map<String, dynamic> user;
  const ProfileTab({super.key, required this.user});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(22),
    children: [
      const Text(
        'Student profile',
        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: ink),
      ),
      const SizedBox(height: 20),
      Center(
        child: CircleAvatar(
          radius: 42,
          child: Text(
            '${user['name']}'[0],
            style: const TextStyle(fontSize: 34),
          ),
        ),
      ),
      const SizedBox(height: 15),
      Text(
        '${user['name']}',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
      ),
      Text('${user['email']}', textAlign: TextAlign.center),
      const SectionTitle('Account'),
      CardBox(
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Student ID'),
              trailing: Text('${user['studentId'] ?? user['id']}'),
            ),
            ListTile(
              leading: const Icon(Icons.phone_outlined),
              title: const Text('Mobile'),
              trailing: Text('${user['mobile']}'),
            ),
          ],
        ),
      ),
    ],
  );
}

class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, required this.size});
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: blue,
      borderRadius: BorderRadius.circular(size * .28),
    ),
    child: Text(
      'HE',
      style: TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w900,
        fontSize: size * .34,
      ),
    ),
  );
}

class CardBox extends StatelessWidget {
  final Widget child;
  const CardBox({super.key, required this.child});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 13),
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE2E9F5)),
    ),
    child: child,
  );
}

class SectionTitle extends StatelessWidget {
  final String title;
  const SectionTitle(this.title, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 26, bottom: 12),
    child: Text(
      title,
      style: const TextStyle(
        fontSize: 19,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
    ),
  );
}

class ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 60, color: blue),
          const SizedBox(height: 14),
          const Text(
            'We could not load the app data',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
          ),
          const SizedBox(height: 8),
          const Text('Check your internet connection and try again.'),
          const SizedBox(height: 18),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}
