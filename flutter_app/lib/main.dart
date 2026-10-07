import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const root='https://cserver.learnwithchampak.live/exams/json';
const legacyRoot='https://raw.githubusercontent.com/Programmer-s-Picnic/examsdata/main';
const authRoot='https://cserver.learnwithchampak.live/exams/api';
const googleServerClientId='72126822432-tug4n0jlflluabmb1h3s4kd5rljuppvg.apps.googleusercontent.com';

const forest=Color(0xff092e2b);
const mint=Color(0xff75e6b5);
const blue=Color(0xff126b5d);
const ink=Color(0xff17223b);
const pale=Color(0xfff3f8f6);
const muted=Color(0xff65718a);

void main()=>runApp(const App());

class ApiException implements Exception{
  final String message;
  const ApiException(this.message);
  @override String toString()=>message;
}

class Api{
  static final cache=<String,Map<String,dynamic>>{};
  static Future<Map<String,dynamic>> request(
    String path,{
    bool refresh=false,
    String method='GET',
    Map<String,dynamic>? body,
    String? token,
    bool auth=false,
  })async{
    final key='${auth?'auth':'data'}:$path';
    if(method=='GET'&&!refresh&&cache[key]!=null)return cache[key]!;
    final urls=auth?['$authRoot/$path.php']:['$root/$path','$legacyRoot/$path'];
    Object? last;
    for(final url in urls){
      final client=HttpClient()..connectionTimeout=const Duration(seconds:15);
      try{
        final req=method=='GET'
          ?await client.getUrl(Uri.parse(url))
          :await client.postUrl(Uri.parse(url));
        req.headers.set('accept','application/json');
        if(token!=null)req.headers.set('authorization','Bearer $token');
        if(body!=null){
          req.headers.contentType=ContentType.json;
          req.write(jsonEncode(body));
        }
        final response=await req.close().timeout(const Duration(seconds:25));
        final raw=await utf8.decoder.bind(response).join();
        final decoded=raw.isEmpty?<String,dynamic>{}:Map<String,dynamic>.from(jsonDecode(raw));
        if(response.statusCode<200||response.statusCode>=300){
          throw ApiException('${decoded['error']??'The service is temporarily unavailable. Please try again.'}');
        }
        if(method=='GET'&&!auth)cache[key]=decoded;
        return decoded;
      }catch(e){
        last=e;
      }finally{
        client.close();
      }
    }
    if(last is ApiException)throw last;
    throw const ApiException('Content is temporarily unavailable. Please try again.');
  }
  static Future<Map<String,dynamic>> auth(String path,{Map<String,dynamic>? body,String? token})=>
      request(path,method:body==null?'GET':'POST',body:body,token:token,auth:true);
}

Future<Map<String,dynamic>> googleAccount()async{
  final service=GoogleSignIn(scopes:const['email','profile'],serverClientId:googleServerClientId);
  await service.signOut();
  final account=await service.signIn();
  if(account==null)throw const ApiException('Google sign-in was cancelled.');
  final auth=await account.authentication;
  if(auth.idToken==null)throw const ApiException('Google did not return a valid identity token.');
  final result=await Api.auth('google-login',body:{'credential':auth.idToken});
  final user=Map<String,dynamic>.from(result['user']);
  Store.scope='${user['id']}';
  await Store.set('user',user);
  await Store.set('token','${result['token']}');
  return user;
}
String googleError(Object e)=>e is PlatformException?'Google sign-in is unavailable right now. Please try again.':'$e';

class Store{
  static String scope='guest';
  static String key(String k)=>['prefs','results','active','sound'].contains(k)?'${k}_$scope':k;
  static Future<SharedPreferences> get p=>SharedPreferences.getInstance();
  static Future<Map<String,dynamic>?> map(String k)async{
    final s=(await p).getString(key(k));
    return s==null?null:Map<String,dynamic>.from(jsonDecode(s));
  }
  static Future<List<dynamic>> list(String k)async{
    final s=(await p).getString(key(k));
    return s==null?[]:List<dynamic>.from(jsonDecode(s));
  }
  static Future<String?> string(String k)async{
    final s=(await p).getString(key(k));
    return s==null?null:'${jsonDecode(s)}';
  }
  static Future<bool> boolValue(String k,{bool fallback=true})async{
    final s=(await p).getString(key(k));
    return s==null?fallback:jsonDecode(s)==true;
  }
  static Future<void> set(String k,Object v)async=>(await p).setString(key(k),jsonEncode(v));
  static Future<void> del(String k)async=>(await p).remove(key(k));
}


Future<List<dynamic>> syncResultsWithServer(List<dynamic> local)async{
  final token=await Store.string('token');
  if(token==null)return local;
  try{
    if(local.isNotEmpty){
      await Api.auth('results',body:{'results':local.take(100).toList()},token:token);
    }
    final remote=await Api.auth('results',token:token);
    final merged=<String,Map<String,dynamic>>{};
    for(final raw in [...local,...List<dynamic>.from(remote['results']??[])]){
      if(raw is! Map)continue;
      final row=Map<String,dynamic>.from(raw);
      final id='${row['id']??''}';
      if(id.isEmpty)continue;
      final current=merged[id];
      if(current==null||'${row['date']??''}'.compareTo('${current['date']??''}')>=0)merged[id]=row;
    }
    final rows=merged.values.toList()
      ..sort((a,b)=>'${b['date']??''}'.compareTo('${a['date']??''}'));
    return rows.take(500).toList();
  }catch(_){
    return local;
  }
}
Future<void>saveResultToServer(Map<String,dynamic> result)async{
  final token=await Store.string('token');
  if(token==null)return;
  try{await Api.auth('results',body:{'result':result},token:token);}catch(_){}
}

class Data{
  final Map<String,dynamic> config;
  final List<Map<String,dynamic>> exams,tests,syllabi,papers;
  Data(this.config,this.exams,this.tests,this.syllabi,this.papers);
  static Future<Data> load({bool refresh=false})async{
    final v=await Future.wait([
      'site-main.json','exams.json','tests.json','exam-syllabus.json','exams-old-papers.json'
    ].map((x)=>Api.request(x,refresh:refresh)));
    return Data(
      v[0],
      List<Map<String,dynamic>>.from(v[1]['exams']??[]),
      List<Map<String,dynamic>>.from(v[2]['tests']??[]),
      List<Map<String,dynamic>>.from(v[3]['syllabi']??[]),
      List<Map<String,dynamic>>.from(v[4]['papers']??[]),
    );
  }
}

class App extends StatelessWidget{
  const App({super.key});
  @override Widget build(BuildContext c)=>MaterialApp(
    debugShowCheckedModeBanner:false,
    title:'UP NaukriGuru',
    theme:ThemeData(
      useMaterial3:true,
      scaffoldBackgroundColor:pale,
      colorScheme:ColorScheme.fromSeed(seedColor:forest,primary:blue,secondary:mint),
      appBarTheme:const AppBarTheme(backgroundColor:Colors.white,foregroundColor:ink),
      inputDecorationTheme:InputDecorationTheme(
        filled:true,fillColor:Colors.white,
        border:OutlineInputBorder(borderRadius:BorderRadius.circular(14)),
      ),
    ),
    home:const Boot(),
  );
}

class Boot extends StatefulWidget{
  const Boot({super.key});
  @override State<Boot>createState()=>_Boot();
}
class _Boot extends State<Boot>{
  late Future<Data> future;
  @override void initState(){super.initState();future=Data.load();}
  @override Widget build(BuildContext c)=>FutureBuilder<Data>(
    future:future,
    builder:(c,s){
      if(s.hasError)return ErrorPage(retry:()=>setState(()=>future=Data.load(refresh:true)));
      if(!s.hasData)return const LoadingPage();
      return SessionStart(d:s.data!);
    },
  );
}

class LoadingPage extends StatelessWidget{
  const LoadingPage({super.key});
  @override Widget build(BuildContext c)=>const Scaffold(
    backgroundColor:forest,
    body:Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
      Logo(72,dark:true),SizedBox(height:18),
      Text('UP NaukriGuru',style:TextStyle(color:Colors.white,fontSize:25,fontWeight:FontWeight.w900)),
      SizedBox(height:6),Text('Uttar Pradesh Exam Preparation',style:TextStyle(color:Colors.white70)),
      SizedBox(height:20),CircularProgressIndicator(color:mint),
    ])),
  );
}

class ErrorPage extends StatelessWidget{
  final VoidCallback retry;
  const ErrorPage({super.key,required this.retry});
  @override Widget build(BuildContext c)=>Scaffold(body:Center(child:Column(
    mainAxisSize:MainAxisSize.min,
    children:[
      const Icon(Icons.cloud_off,size:62,color:blue),
      const SizedBox(height:12),
      const Text('Could not load app data',style:TextStyle(fontSize:21,fontWeight:FontWeight.w900)),
      const SizedBox(height:14),
      FilledButton(onPressed:retry,child:const Text('Try again')),
    ],
  )));
}

class SessionStart extends StatefulWidget{
  final Data d;
  const SessionStart({super.key,required this.d});
  @override State<SessionStart>createState()=>_SessionStart();
}
class _SessionStart extends State<SessionStart>{
  late Future<Map<String,dynamic>?> future;
  @override void initState(){super.initState();future=restore();}
  Future<Map<String,dynamic>?>restore()async{
    final token=await Store.string('token');
    if(token==null)return null;
    try{
      final response=await Api.auth('me',token:token);
      return Map<String,dynamic>.from(response['user']);
    }catch(_){
      await Store.del('token');await Store.del('user');return null;
    }
  }
  @override Widget build(BuildContext c)=>FutureBuilder<Map<String,dynamic>?>(
    future:future,
    builder:(c,s){
      if(s.connectionState!=ConnectionState.done)return const LoadingPage();
      final user=s.data;
      if(user==null)return Landing(d:widget.d);
      Store.scope='${user['id']}';
      return FutureBuilder<Map<String,dynamic>?>(
        future:Store.map('prefs'),
        builder:(c,p){
          if(p.connectionState!=ConnectionState.done)return const LoadingPage();
          final prefs=p.data;
          if(prefs?['primary']!=null){
            final selected=Set<String>.from(prefs?['selected']??[prefs?['primary']]);
            return Shell(d:widget.d,u:user,selected:selected,primary:'${prefs?['primary']}');
          }
          return Goals(d:widget.d,u:user);
        },
      );
    },
  );
}

class Landing extends StatelessWidget{
  final Data d;
  const Landing({super.key,required this.d});
  @override Widget build(BuildContext c){
    final content=Map<String,dynamic>.from(d.config['content']?['landing']??{});
    final available=d.tests.where((t)=>t['available']==true).toList();
    final count=d.tests.fold<int>(0,(a,t)=>a+((t['questions']as List?)?.length??0));
    return Scaffold(
      backgroundColor:forest,
      appBar:AppBar(
        backgroundColor:forest,foregroundColor:Colors.white,
        title:const Row(children:[Logo(38,dark:true),SizedBox(width:10),Text('UP NaukriGuru',style:TextStyle(fontWeight:FontWeight.w900))]),
        actions:[TextButton(onPressed:()=>login(c),child:const Text('Sign in',style:TextStyle(color:Colors.white)))],
      ),
      body:ListView(children:[
        Padding(
          padding:const EdgeInsets.fromLTRB(22,38,22,36),
          child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Pill('${content['badge']??'UTTAR PRADESH EXAM PREPARATION'}',dark:true),
            const SizedBox(height:18),
            Text('${content['titleBefore']??'Prepare Smarter for'}\n${content['titleHighlight']??'Government Exams'}',
              style:const TextStyle(color:Colors.white,fontSize:39,height:1.08,fontWeight:FontWeight.w900)),
            const SizedBox(height:16),
            Text('${content['description']??'Focused practice, mock tests and performance analysis.'}',
              style:const TextStyle(color:Color(0xffd1e2df),fontSize:17,height:1.5)),
            const SizedBox(height:23),
            FilledButton(
              onPressed:()=>picker(c),
              style:FilledButton.styleFrom(backgroundColor:mint,foregroundColor:forest,minimumSize:const Size.fromHeight(54)),
              child:const Text('Choose your examination →'),
            ),
            const SizedBox(height:10),
            OutlinedButton(
              onPressed:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>DiagnosticPage(d:d,reload:(){}))),
              style:OutlinedButton.styleFrom(foregroundColor:Colors.white,side:const BorderSide(color:Colors.white54),minimumSize:const Size.fromHeight(52)),
              child:const Text('Take Free Diagnostic Test'),
            ),
            const SizedBox(height:22),
            Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[
              Metric('${d.exams.length}','Exam paths'),
              Metric('$count+','Questions'),
              const Metric('3','Timing modes'),
            ]),
          ]),
        ),
        Container(
          padding:const EdgeInsets.fromLTRB(18,28,18,40),
          decoration:const BoxDecoration(color:pale,borderRadius:BorderRadius.vertical(top:Radius.circular(30))),
          child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            const Text('Preparation paths',style:TextStyle(fontSize:27,fontWeight:FontWeight.w900,color:ink)),
            const SizedBox(height:15),
            ...d.exams.map((e)=>ExamCard(e:e,tap:e['available']==true?()=>login(c,exam:'${e['id']}'):null)),
            if(available.isNotEmpty)...[
              const SizedBox(height:12),
              Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
                const Pill('AVAILABLE NOW'),
                const SizedBox(height:10),
                Text('${available.first['title']}',style:const TextStyle(fontSize:20,fontWeight:FontWeight.w900)),
                Text('${available.first['description']}'),
                const SizedBox(height:12),
                FilledButton(onPressed:()=>login(c,exam:'up-police',test:'${available.first['id']}'),child:const Text('View test →')),
              ])),
            ],
          ]),
        ),
      ]),
    );
  }
  void login(BuildContext c,{String? exam,String? test})=>
      Navigator.push(c,MaterialPageRoute(builder:(_)=>Login(d:d,exam:exam,test:test)));
  void picker(BuildContext c)=>showModalBottomSheet(
    context:c,isScrollControlled:true,
    builder:(_)=>SafeArea(child:Padding(
      padding:const EdgeInsets.all(18),
      child:Column(mainAxisSize:MainAxisSize.min,children:[
        const Text('Choose your examination',style:TextStyle(fontSize:22,fontWeight:FontWeight.w900)),
        const SizedBox(height:12),
        ...d.exams.map((e){
          final ok=e['available']==true;
          return ListTile(
            enabled:ok,
            leading:Icon(ok?Icons.local_police_outlined:Icons.schedule,color:ok?blue:Colors.grey),
            title:Text('${e['name']}',style:const TextStyle(fontWeight:FontWeight.w800)),
            subtitle:Text(ok?'${e['authority']}':'Coming soon'),
            trailing:ok?const Icon(Icons.arrow_forward):null,
            onTap:ok?(){Navigator.pop(c);login(c,exam:'${e['id']}');}:null,
          );
        }),
        const DeveloperCredit(),
      ]),
    )),
  );
}

class Login extends StatefulWidget{
  final Data d;final String? exam,test;
  const Login({super.key,required this.d,this.exam,this.test});
  @override State<Login>createState()=>_Login();
}
class _Login extends State<Login>{
  final id=TextEditingController(),pw=TextEditingController();
  bool hide=true,busy=false;String? err;
  Future<void>finish(Map<String,dynamic>u)async{
    final prefs=await Store.map('prefs');
    if(!mounted)return;
    final remembered=widget.exam==null&&widget.test==null&&prefs?['primary']!=null;
    if(remembered){
      final primary='${prefs?['primary']}';
      final selected=Set<String>.from(prefs?['selected']??[primary]);
      Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>Shell(d:widget.d,u:u,selected:selected,primary:primary)),(_)=>false);
    }else{
      Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>Goals(d:widget.d,u:u,pre:widget.exam,test:widget.test)),(_)=>false);
    }
  }
  Future<void>go()async{
    setState(() { busy=true; err=null; });
    try{
      final result=await Api.auth('login',body:{'login':id.text.trim().toLowerCase(),'password':pw.text});
      final u=Map<String,dynamic>.from(result['user']);
      Store.scope='${u['id']}';
      await Store.set('user',u);await Store.set('token','${result['token']}');
      await finish(u);
    }catch(e){if(mounted)setState(() { busy=false; err='$e'; });}
  }
  Future<void>google()async{
    setState(() { busy=true; err=null; });
    try{await finish(await googleAccount());}
    catch(e){if(mounted)setState(() { busy=false; err=googleError(e); });}
  }
  @override Widget build(BuildContext c)=>Scaffold(
    backgroundColor:forest,
    body:SafeArea(child:Center(child:SingleChildScrollView(
      padding:const EdgeInsets.all(22),
      child:Container(
        padding:const EdgeInsets.all(24),
        decoration:BoxDecoration(color:pale,borderRadius:BorderRadius.circular(26)),
        child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
          const Center(child:Logo(64)),const SizedBox(height:16),
          const Text('Welcome back',textAlign:TextAlign.center,style:TextStyle(fontSize:29,fontWeight:FontWeight.w900)),
          const SizedBox(height:8),
          const Text('Continue your preparation with tests, feedback and a clear plan.',textAlign:TextAlign.center),
          const SizedBox(height:20),
          TextField(controller:id,keyboardType:TextInputType.emailAddress,decoration:const InputDecoration(labelText:'Mobile number or email',prefixIcon:Icon(Icons.person_outline))),
          const SizedBox(height:12),
          TextField(controller:pw,obscureText:hide,decoration:InputDecoration(labelText:'Password',prefixIcon:const Icon(Icons.lock_outline),suffixIcon:IconButton(onPressed:()=>setState(()=>hide=!hide),icon:Icon(hide?Icons.visibility_outlined:Icons.visibility_off_outlined)))),
          if(err!=null)Padding(padding:const EdgeInsets.only(top:9),child:Text(err!,style:const TextStyle(color:Colors.red))),
          const SizedBox(height:16),
          FilledButton(onPressed:busy?null:go,style:FilledButton.styleFrom(minimumSize:const Size.fromHeight(52)),child:Text(busy?'Please wait…':'Sign in →')),
          const Padding(padding:EdgeInsets.symmetric(vertical:10),child:Row(children:[Expanded(child:Divider()),Padding(padding:EdgeInsets.symmetric(horizontal:10),child:Text('OR')),Expanded(child:Divider())])),
          OutlinedButton.icon(
            onPressed:busy?null:google,
            icon:const Text('G',style:TextStyle(fontSize:20,fontWeight:FontWeight.w900,color:Color(0xff4285f4))),
            label:const Text('Continue with Google'),
            style:OutlinedButton.styleFrom(minimumSize:const Size.fromHeight(52),backgroundColor:Colors.white),
          ),
          const SizedBox(height:8),
          TextButton(onPressed:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>Register(d:widget.d,exam:widget.exam,test:widget.test))),child:const Text('New student? Create an account')),
        ]),
      ),
    ))),
  );
}

class Register extends StatefulWidget{
  final Data d;final String? exam,test;
  const Register({super.key,required this.d,this.exam,this.test});
  @override State<Register>createState()=>_Register();
}
class _Register extends State<Register>{
  final name=TextEditingController(),email=TextEditingController(),mobile=TextEditingController(),password=TextEditingController(),confirm=TextEditingController();
  bool busy=false;String? err;
  Future<void>finish(Map<String,dynamic>u)async{
    if(mounted)Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>Goals(d:widget.d,u:u,pre:widget.exam,test:widget.test)),(_)=>false);
  }
  Future<void>go()async{
    if(password.text!=confirm.text){setState(()=>err='Passwords do not match.');return;}
    if(!RegExp(r'^[6-9][0-9]{9}$').hasMatch(mobile.text.trim())){setState(()=>err='Enter a valid 10-digit Indian mobile number.');return;}
    if(password.text.length<8){setState(()=>err='Password must contain at least 8 characters.');return;}
    setState(() { busy=true; err=null; });
    try{
      final result=await Api.auth('register',body:{
        'name':name.text.trim(),'email':email.text.trim().toLowerCase(),'mobile':mobile.text.trim(),
        'password':password.text,'password_confirmation':confirm.text
      });
      final u=Map<String,dynamic>.from(result['user']);
      Store.scope='${u['id']}';await Store.set('user',u);await Store.set('token','${result['token']}');
      await finish(u);
    }catch(e){if(mounted)setState(() { busy=false; err='$e'; });}
  }
  Future<void>google()async{
    setState(() { busy=true; err=null; });
    try{await finish(await googleAccount());}
    catch(e){if(mounted)setState(() { busy=false; err=googleError(e); });}
  }
  @override Widget build(BuildContext c)=>Scaffold(
    backgroundColor:forest,
    appBar:AppBar(backgroundColor:forest,foregroundColor:Colors.white,title:const Text('Create account')),
    body:SafeArea(child:ListView(padding:const EdgeInsets.all(22),children:[
      Container(
        padding:const EdgeInsets.all(22),
        decoration:BoxDecoration(color:pale,borderRadius:BorderRadius.circular(26)),
        child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
          const Center(child:Logo(60)),const SizedBox(height:14),
          const Text('Create student account',textAlign:TextAlign.center,style:TextStyle(fontSize:27,fontWeight:FontWeight.w900)),
          const Text('Save your preparation and test results.',textAlign:TextAlign.center),
          const SizedBox(height:14),
          OutlinedButton.icon(
            onPressed:busy?null:google,
            icon:const Text('G',style:TextStyle(fontSize:20,fontWeight:FontWeight.w900,color:Color(0xff4285f4))),
            label:const Text('Continue with Google'),
            style:OutlinedButton.styleFrom(minimumSize:const Size.fromHeight(52),backgroundColor:Colors.white),
          ),
          const Padding(padding:EdgeInsets.symmetric(vertical:10),child:Row(children:[Expanded(child:Divider()),Padding(padding:EdgeInsets.symmetric(horizontal:10),child:Text('OR REGISTER WITH EMAIL')),Expanded(child:Divider())])),
          TextField(controller:name,textCapitalization:TextCapitalization.words,decoration:const InputDecoration(labelText:'Full name')),
          const SizedBox(height:10),
          TextField(controller:email,keyboardType:TextInputType.emailAddress,decoration:const InputDecoration(labelText:'Email')),
          const SizedBox(height:10),
          TextField(controller:mobile,keyboardType:TextInputType.phone,maxLength:10,decoration:const InputDecoration(labelText:'Mobile number',counterText:'')),
          const SizedBox(height:10),
          TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Password (minimum 8 characters)')),
          const SizedBox(height:10),
          TextField(controller:confirm,obscureText:true,decoration:const InputDecoration(labelText:'Confirm password')),
          if(err!=null)Padding(padding:const EdgeInsets.only(top:9),child:Text(err!,style:const TextStyle(color:Colors.red))),
          const SizedBox(height:15),
          FilledButton(onPressed:busy?null:go,child:Text(busy?'Please wait…':'Register →')),
        ]),
      ),
    ])),
  );
}

class Goals extends StatefulWidget{
  final Data d;final Map<String,dynamic>u;final String? pre,test;
  const Goals({super.key,required this.d,required this.u,this.pre,this.test});
  @override State<Goals>createState()=>_Goals();
}
class _Goals extends State<Goals>{
  late Set<String> selected={if(widget.pre!=null)widget.pre!};
  String? primary;
  @override void initState(){super.initState();primary=widget.pre;restore();}
  Future<void>restore()async{
    final v=await Store.map('prefs');
    if(widget.pre==null&&v!=null&&mounted){
      setState((){
        selected=Set<String>.from(v['selected']??[]);
        primary=v['primary'];
      });
    }
  }
  Future<void>save()async{
    if(selected.isEmpty||primary==null){
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Select an examination to continue.')));
      return;
    }
    await Store.set('prefs',{'selected':selected.toList(),'primary':primary});
    Map<String,dynamic>? launch;
    if(widget.test!=null){
      final matches=widget.d.tests.where((t)=>t['id']==widget.test&&t['available']==true).toList();
      if(matches.isNotEmpty)launch=matches.first;
    }
    if(mounted)Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>Shell(d:widget.d,u:widget.u,selected:selected,primary:primary!,launch:launch)));
  }
  @override Widget build(BuildContext c)=>Scaffold(
    appBar:AppBar(title:const Text('Choose your exam')),
    body:SafeArea(top:false,child:ListView(
      padding:const EdgeInsets.fromLTRB(18,18,18,96),
      children:[
        const Pill('YOUR PREPARATION'),const SizedBox(height:9),
        const Text('Which exam are you preparing for?',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
        const Text('आप किस परीक्षा की तैयारी कर रहे हैं?',style:TextStyle(fontSize:18,color:blue)),
        const SizedBox(height:16),
        ...widget.d.exams.map((e){
          final id='${e['id']}';final on=selected.contains(id);final available=e['available']==true;
          return ExamCard(e:e,on:on,tap:available?()=>setState((){selected={id};primary=id;}):null);
        }),
        if(selected.isNotEmpty)DropdownButtonFormField<String>(
          value:selected.contains(primary)?primary:null,
          decoration:const InputDecoration(labelText:'Primary exam focus'),
          items:selected.map((id)=>DropdownMenuItem(value:id,child:Text('${widget.d.exams.firstWhere((e)=>e['id']==id)['name']}'))).toList(),
          onChanged:(v)=>setState(()=>primary=v),
        ),
        const SizedBox(height:17),
        FilledButton(onPressed:save,style:FilledButton.styleFrom(minimumSize:const Size.fromHeight(54)),child:const Text('Open my dashboard →')),
      ],
    )),
  );
}

Map<String,dynamic> normalizeQuestionRecord(Map<String,dynamic> raw){
  final record=Map<String,dynamic>.from(jsonDecode(jsonEncode(raw)));
  final examId='${record['examId']??''}';
  record['id']??=record['documentId']??(record['paper']!=null?'syllabus-$examId':'document-$examId-${record['year']??''}-${record['shift']??''}');
  record['title']??=record['paper']??'Question set';
  record['documentType']??=(record['paper']!=null?'syllabus-question-set':'question-set');
  return record;
}
bool approvedQuestionRecord(Map<String,dynamic> raw){
  final questions=raw['questions'];
  return raw['adminValidation']?['status']=='approved'&&questions is List&&questions.isNotEmpty;
}
Map<String,dynamic>? questionSetTest(Map<String,dynamic> raw){
  final record=normalizeQuestionRecord(raw);
  if(!approvedQuestionRecord(record)||record['testEnabled']==false)return null;
  final questions=List<Map<String,dynamic>>.from(record['questions']);
  final config=Map<String,dynamic>.from(record['testConfig']??{});
  final seconds=NumberTools.intValue(config['questionSeconds'],fallback:48);
  final minutes=NumberTools.intValue(config['durationMinutes'],fallback:max(1,(questions.length*seconds/60).round()));
  final correct=NumberTools.numValue(config['correctMarks'],fallback:NumberTools.numValue(record['marksPerQuestion'],fallback:2));
  final wrong=NumberTools.numValue(config['wrongMarks'],fallback:-NumberTools.numValue(record['negativeMarking']));
  final unanswered=NumberTools.numValue(config['unansweredMarks']);
  final type='${record['documentType']??'question-set'}';
  return {
    'id':'docq-${record['id']}',
    'baseTestId':'docq-${record['id']}',
    'type':type.contains('previous')||type.contains('exam-paper')?'previous_year':'question_set',
    'examId':record['examId'],
    'examIds':[record['examId']],
    'documentId':record['id'],
    'paperId':record['id'],
    'title':record['title'],
    'description':record['description']??[
      record['examDate']??record['year'],
      record['shift']==null?null:'Shift ${record['shift']}'
    ].where((x)=>x!=null&&'$x'.isNotEmpty).join(' · '),
    'category':record['category']??(type.contains('previous')||type.contains('exam-paper')?'Previous Year Paper':'Question Set'),
    'difficulty':record['difficulty']??'Exam practice',
    'available':true,
    'questions':questions.map((q)=>{
      ...q,
      'explanation':('${q['explanation']??''}'.trim().isEmpty?'Review the correct answer.':q['explanation'])
    }).toList(),
    'totalMarks':questions.fold<num>(0,(sum,q)=>sum+NumberTools.numValue(q['marks'],fallback:correct)),
    'negativeMarking':wrong<0?-wrong:0,
    'marking':{'correct':correct,'incorrect':wrong,'unanswered':unanswered},
    'timing':{'totalSeconds':minutes*60,'questionSeconds':seconds},
    'defaultMode':config['defaultMode']??'total-timed',
    'feedbackMode':config['feedbackMode']??'on-completion',
    'passPercent':NumberTools.intValue(record['passingPercent'],fallback:0),
  };
}
List<Map<String,dynamic>> approvedQuestionRecords(Data d,String examId){
  final all=<Map<String,dynamic>>[
    ...d.papers.map(normalizeQuestionRecord),
    ...d.syllabi.where((s)=>s['questions'] is List).map(normalizeQuestionRecord),
  ];
  return all.where((r)=>r['examId']==examId&&approvedQuestionRecord(r)).toList();
}

class Shell extends StatefulWidget{
  final Data d;final Map<String,dynamic>u;final Set<String>selected;final String primary;final Map<String,dynamic>? launch;
  const Shell({super.key,required this.d,required this.u,required this.selected,required this.primary,this.launch});
  @override State<Shell>createState()=>_Shell();
}
class _Shell extends State<Shell>{
  int tab=0;
  List<dynamic> results=[];
  Map<String,dynamic>? active;
  bool sound=true;

  List<Map<String,dynamic>> get tests{
    final base=widget.d.tests.where((t)=>
      t['available']==true &&
      List<dynamic>.from(t['examIds']??[t['examId']]).any(widget.selected.contains)
    ).toList();
    final generated=<Map<String,dynamic>>[];
    for(final examId in widget.selected){
      for(final record in approvedQuestionRecords(widget.d,examId)){
        final test=questionSetTest(record);
        if(test!=null&&!base.any((t)=>t['id']==test['id'])&&!generated.any((t)=>t['id']==test['id']))generated.add(test);
      }
    }
    return [...base,...generated];
  }

  @override void initState(){
    super.initState();load();
    if(widget.launch!=null)WidgetsBinding.instance.addPostFrameCallback((_){instructions(context,widget.launch!,load,sound:sound);});
  }
  Future<void>load()async{
    final local=await Store.list('results');
    final r=await syncResultsWithServer(local);
    if(r.length!=local.length||jsonEncode(r)!=jsonEncode(local))await Store.set('results',r);
    final a=await Store.map('active');
    final s=await Store.boolValue('sound');
    if(mounted)setState(() { results=r; active=a; sound=s; });
  }
  void go(int index)=>setState(()=>tab=index);
  Future<void>toggleSound()async{
    sound=!sound;await Store.set('sound',sound);if(mounted)setState((){});
  }
  @override Widget build(BuildContext c){
    final exam=widget.d.exams.firstWhere((e)=>e['id']==widget.primary);
    final syllabusList=widget.d.syllabi.where((s)=>s['examId']==widget.primary).toList();
    final syllabus=syllabusList.isEmpty?<String,dynamic>{'examId':widget.primary,'sections':[]}:syllabusList.first;
    final pages=<Widget>[
      HomePage(u:widget.u,tests:tests,exam:exam,results:results,active:active,reload:load,go:go,sound:sound),
      ExamHub(exam:exam,syllabus:syllabus,papers:widget.d.papers,tests:tests,results:results,reload:load,sound:sound),
      TestsPage(tests:tests,results:results,reload:load,sound:sound),
      DiagnosticPage(d:widget.d,reload:load,sound:sound),
      ResultsPage(items:results,tests:widget.d.tests,reload:load,sound:sound),
      MorePage(
        d:widget.d,u:widget.u,exam:exam,sound:sound,onSound:toggleSound,
        onGuide:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>const GuidePage())),
        onChangeGoal:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>Goals(d:widget.d,u:widget.u))),
      ),
    ];
    return Scaffold(
      appBar:AppBar(
        title:const Row(children:[Logo(38),SizedBox(width:9),Text('UP NaukriGuru',style:TextStyle(fontSize:18,fontWeight:FontWeight.w900))]),
        actions:[
          IconButton(onPressed:load,tooltip:'Refresh',icon:const Icon(Icons.refresh)),
          Padding(padding:const EdgeInsets.only(right:12),child:CircleAvatar(backgroundColor:mint,foregroundColor:forest,child:Text('${widget.u['name']}'[0].toUpperCase()))),
        ],
      ),
      body:IndexedStack(index:tab,children:pages),
      bottomNavigationBar:NavigationBar(
        selectedIndex:tab,
        labelBehavior:NavigationDestinationLabelBehavior.onlyShowSelected,
        onDestinationSelected:go,
        destinations:const[
          NavigationDestination(icon:Icon(Icons.home_outlined),selectedIcon:Icon(Icons.home),label:'Home'),
          NavigationDestination(icon:Icon(Icons.local_police_outlined),selectedIcon:Icon(Icons.local_police),label:'Exam'),
          NavigationDestination(icon:Icon(Icons.quiz_outlined),selectedIcon:Icon(Icons.quiz),label:'Tests'),
          NavigationDestination(icon:Icon(Icons.health_and_safety_outlined),selectedIcon:Icon(Icons.health_and_safety),label:'Diagnostic'),
          NavigationDestination(icon:Icon(Icons.insights_outlined),selectedIcon:Icon(Icons.insights),label:'Results'),
          NavigationDestination(icon:Icon(Icons.more_horiz),label:'More'),
        ],
      ),
    );
  }
}

class HomePage extends StatelessWidget{
  final Map<String,dynamic>u,exam;
  final List<Map<String,dynamic>>tests;
  final List<dynamic>results;
  final Map<String,dynamic>?active;
  final VoidCallback reload;
  final void Function(int) go;
  final bool sound;
  const HomePage({super.key,required this.u,required this.tests,required this.exam,required this.results,required this.active,required this.reload,required this.go,required this.sound});
  @override Widget build(BuildContext c){
    final avg=results.isEmpty?0:(results.fold<num>(0,(a,r)=>a+NumberTools.numValue(r['percent']))/results.length).round();
    final passed=results.where((r)=>r['passed']==true).length;
    final completed=results.map((r)=>r['baseTestId']??r['testId']).toSet();
    final next=tests.where((t)=>!completed.contains(t['id'])).toList();
    final suggested=next.isNotEmpty?next.first:(tests.isNotEmpty?tests.first:null);
    return ListView(padding:const EdgeInsets.all(18),children:[
      Text('Good ${dayPart()}, ${'${u['name']}'.split(' ').first}',style:const TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
      const Text('Track your tests, results and current preparation priorities.',style:TextStyle(color:muted)),
      const SizedBox(height:16),
      Box(
        color:forest,
        tap:()=>go(1),
        child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          const Text('PRIMARY GOAL',style:TextStyle(color:mint,fontSize:11,fontWeight:FontWeight.w900)),
          const SizedBox(height:8),
          Text('${exam['name']}',style:const TextStyle(color:Colors.white,fontSize:25,fontWeight:FontWeight.w900)),
          Text('${exam['description']}',style:const TextStyle(color:Colors.white70)),
          const SizedBox(height:12),
          Text('${exam['authority']}',style:const TextStyle(color:mint,fontWeight:FontWeight.w700)),
          const SizedBox(height:12),
          Row(children:[Text('$avg% average',style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w800)),const Spacer(),const Icon(Icons.arrow_forward,color:Colors.white)]),
        ]),
      ),
      Box(
        color:const Color(0xffe8f5ef),
        tap:()=>go(3),
        child:const Row(children:[
          Icon(Icons.health_and_safety_outlined,color:blue),SizedBox(width:12),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('Take Free Diagnostic Test',style:TextStyle(fontWeight:FontWeight.w900)),
            Text('Get a subject-wise report with preparation priorities.',style:TextStyle(color:muted)),
          ])),
          Icon(Icons.chevron_right),
        ]),
      ),
      if(active!=null)Box(
        color:const Color(0xfffff6df),
        child:Row(children:[
          const Icon(Icons.restore,color:Colors.orange),const SizedBox(width:10),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            const Text('Saved attempt',style:TextStyle(fontWeight:FontWeight.w900)),
            Text('${active!['title']??'Your test'}'),
            Text('Question ${NumberTools.intValue(active!['current'])+1}',style:const TextStyle(color:muted)),
          ])),
          FilledButton(onPressed:(){
            final saved=Map<String,dynamic>.from(active!);
            final t=Map<String,dynamic>.from(saved['test']??{});
            Navigator.push(c,MaterialPageRoute(builder:(_)=>TestPage(t:t,mode:'${saved['mode']}',feedback:'${saved['feedback']}',saved:saved,done:reload,sound:sound)));
          },child:const Text('Resume')),
        ]),
      ),
      Row(children:[
        Expanded(child:Stat('${results.length}','Attempts')),const SizedBox(width:8),
        Expanded(child:Stat('$avg%','Average')),const SizedBox(width:8),
        Expanded(child:Stat('$passed','Passed')),
      ]),
      const TitleText('Recommended next step'),
      if(suggested!=null)TestCard(t:suggested,tap:()=>instructions(c,suggested,reload,sound:sound))
      else const Box(child:Text('No test is available yet.')),
      const TitleText('Quick access'),
      Row(children:[
        Expanded(child:ActionTile(icon:Icons.quiz_outlined,title:'Tests',tap:()=>go(2))),const SizedBox(width:8),
        Expanded(child:ActionTile(icon:Icons.insights_outlined,title:'Results',tap:()=>go(4))),const SizedBox(width:8),
        Expanded(child:ActionTile(icon:Icons.menu_book_outlined,title:'Guide',tap:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>const GuidePage())))),
      ]),
    ]);
  }
}

class ExamHub extends StatelessWidget{
  final Map<String,dynamic>exam,syllabus;
  final List<Map<String,dynamic>>papers,tests;
  final List<dynamic>results;
  final VoidCallback reload;
  final bool sound;
  const ExamHub({super.key,required this.exam,required this.syllabus,required this.papers,required this.tests,required this.results,required this.reload,required this.sound});
  Future<void>open(String value)async{
    final uri=Uri.tryParse(value);
    if(uri==null)return;
    if(!await launchUrl(uri,mode:LaunchMode.externalApplication))throw const ApiException('Could not open document.');
  }
  void openQuestions(BuildContext c,Map<String,dynamic>record){
    Navigator.push(c,MaterialPageRoute(builder:(_)=>QuestionDocumentPage(record:normalizeQuestionRecord(record),syllabus:syllabus,reload:reload,sound:sound)));
  }
  @override Widget build(BuildContext c){
    final approved=syllabus['adminValidation']?['status']=='approved';
    final approvedPapers=papers.where((p)=>p['examId']==exam['id']&&p['adminValidation']?['status']=='approved').toList()
      ..sort((a,b)=>'${b['examDate']}'.compareTo('${a['examDate']}'));
    final practice=tests.where((t)=>t['type']!='diagnostic'&&List<dynamic>.from(t['examIds']??[]).contains(exam['id'])).toList();
    final latest=results.isEmpty?null:results.first;
    final syllabusRecord=normalizeQuestionRecord(syllabus);
    final syllabusQuestions=approvedQuestionRecord(syllabusRecord);
    return ListView(padding:const EdgeInsets.all(18),children:[
      Pill('${exam['name']}'.toUpperCase()),
      const SizedBox(height:8),
      Text('${exam['name']}',style:const TextStyle(fontSize:29,fontWeight:FontWeight.w900)),
      Text('${exam['description']}',style:const TextStyle(color:muted)),
      const TitleText('Overview'),
      ...List<Map<String,dynamic>>.from(exam['sources']??[]).map((source)=>Box(child:Row(children:[
        const Icon(Icons.description_outlined,color:blue),const SizedBox(width:10),
        Expanded(child:Text('${source['label']}',style:const TextStyle(fontWeight:FontWeight.w800))),
        IconButton(onPressed:()=>open('${source['url']}'),icon:const Icon(Icons.open_in_new)),
      ]))),
      const TitleText('How to use'),
      const Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        GuideStep(1,'Review the syllabus','Use the subject and topic outline to plan your preparation.'),
        GuideStep(2,'Open question sets','Validated documents with questions can be read directly in the app.'),
        GuideStep(3,'Attempt as test','The same questions can be attempted using the test engine.'),
        GuideStep(4,'Practise','Use focused practice, previous papers and mock tests.'),
        GuideStep(5,'Check results','Review accuracy and weak areas, then retake where needed.'),
      ])),
      const TitleText('Syllabus'),
      if(approved)...[
        Wrap(spacing:8,runSpacing:8,children:[
          Chip(label:Text('${syllabus['totalQuestions']??150} questions')),
          Chip(label:Text('${syllabus['totalMarks']??300} marks')),
          Chip(label:Text('${syllabus['durationMinutes']??120} minutes')),
          Chip(label:Text(syllabus['negativeMarking']==true?'Negative marking':'No negative marking')),
        ]),
        const SizedBox(height:10),
        ...List<Map<String,dynamic>>.from(syllabus['sections']??[]).map((section)=>Box(child:Column(
          crossAxisAlignment:CrossAxisAlignment.start,
          children:[
            Text('${section['name']}',style:const TextStyle(fontSize:17,fontWeight:FontWeight.w900)),
            const SizedBox(height:6),
            ...List<String>.from(section['topics']??[]).map((topic)=>Padding(padding:const EdgeInsets.symmetric(vertical:2),child:Text('• $topic'))),
          ],
        ))),
        Wrap(spacing:8,runSpacing:8,children:[
          if('${syllabus['source']??''}'.isNotEmpty)OutlinedButton.icon(onPressed:()=>open('${syllabus['source']}'),icon:const Icon(Icons.open_in_new),label:const Text('Open official syllabus')),
          if(syllabusQuestions)OutlinedButton.icon(onPressed:()=>openQuestions(c,syllabusRecord),icon:const Icon(Icons.menu_book_outlined),label:Text('View ${(syllabusRecord['questions']as List).length} questions')),
          if(syllabusQuestions&&syllabusRecord['testEnabled']!=false)FilledButton.icon(onPressed:(){
            final t=questionSetTest(syllabusRecord);if(t!=null)instructions(c,t,reload,sound:sound);
          },icon:const Icon(Icons.play_arrow),label:const Text('Attempt as test')),
        ]),
      ]else
        const Box(child:Text('Syllabus details will be available shortly.')),
      const TitleText('Previous papers and question sets'),
      if(approvedPapers.isEmpty)
        const Box(child:Text('Previous papers will be available shortly.'))
      else
        ...approvedPapers.map((raw){
          final paper=normalizeQuestionRecord(raw);
          final count=(paper['questions']as List?)?.length??0;
          final test=questionSetTest(paper);
          return Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${paper['title']}',style:const TextStyle(fontWeight:FontWeight.w900)),
            Text('${paper['language']??'Hindi / English'} · ${count>0?'$count questions available':'Paper details'}',style:const TextStyle(color:muted)),
            const SizedBox(height:8),
            Wrap(spacing:8,runSpacing:8,children:[
              if(count>0)OutlinedButton.icon(onPressed:()=>openQuestions(c,paper),icon:const Icon(Icons.menu_book_outlined),label:const Text('View questions')),
              if(test!=null)FilledButton.icon(onPressed:()=>instructions(c,test,reload,sound:sound),icon:const Icon(Icons.play_arrow),label:const Text('Attempt as test')),
              if('${paper['publicSourceUrl']??''}'.isNotEmpty)OutlinedButton(onPressed:()=>open('${paper['publicSourceUrl']}'),child:const Text('Open document')),
            ]),
          ]));
        }),
      const TitleText('Practice and mock tests'),
      if(practice.isEmpty)const Box(child:Text('Practice tests will appear here when available.'))
      else ...practice.map((t)=>TestCard(t:t,tap:()=>instructions(c,t,reload,sound:sound))),
      const TitleText('Results and retakes'),
      Box(color:const Color(0xffe8f5ef),child:Text(
        latest==null?'Complete a test to see scoring, explanations and topic analysis.':'${results.length} attempt${results.length==1?'':'s'} · latest score ${latest['percent']}%. Open Results to review and retake.'
      )),
      const TitleText('Recruitment stages'),
      ...List<Map<String,dynamic>>.from(exam['stages']??[]).asMap().entries.map((entry)=>Box(child:Row(
        crossAxisAlignment:CrossAxisAlignment.start,
        children:[
          CircleAvatar(backgroundColor:mint,foregroundColor:forest,child:Text('${entry.key+1}')),
          const SizedBox(width:12),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${entry.value['name']}',style:const TextStyle(fontWeight:FontWeight.w900)),
            Text('${entry.value['description']}',style:const TextStyle(color:muted)),
          ])),
        ],
      ))),
    ]);
  }
}

class QuestionDocumentPage extends StatelessWidget{
  final Map<String,dynamic>record,syllabus;
  final VoidCallback reload;
  final bool sound;
  const QuestionDocumentPage({super.key,required this.record,required this.syllabus,required this.reload,required this.sound});
  String subjectLabel(String id){
    final rows=List<Map<String,dynamic>>.from(syllabus['sections']??[]);
    final matches=rows.where((s)=>'${s['id']}'==id).toList();
    return matches.isEmpty?id:'${matches.first['name']}';
  }
  String typeLabel(){
    final type='${record['documentType']??''}'.toLowerCase();
    if(type.contains('previous'))return 'Previous year paper';
    if(type.contains('exam-paper'))return 'Exam paper';
    if(type.contains('syllabus'))return 'Syllabus question set';
    return 'Question set';
  }
  Future<void>openSource()async{
    final value='${record['publicSourceUrl']??record['source']??''}';
    if(value.isEmpty)return;
    final uri=Uri.tryParse(value);if(uri==null)return;
    await launchUrl(uri,mode:LaunchMode.externalApplication);
  }
  @override Widget build(BuildContext c){
    final questions=List<Map<String,dynamic>>.from(record['questions']??[]);
    final test=questionSetTest(record);
    final meta=[
      record['examDate']??record['year'],
      record['shift']==null?null:'Shift ${record['shift']}',
      '${questions.length} questions',
    ].where((x)=>x!=null&&'$x'.isNotEmpty).join(' · ');
    return Scaffold(
      appBar:AppBar(title:Text(typeLabel())),
      body:ListView(padding:const EdgeInsets.fromLTRB(18,18,18,90),children:[
        Text('${record['title']}',style:const TextStyle(fontSize:27,fontWeight:FontWeight.w900)),
        Text(meta,style:const TextStyle(color:muted)),
        const SizedBox(height:14),
        Wrap(spacing:8,runSpacing:8,children:[
          if(test!=null)FilledButton.icon(onPressed:()=>instructions(c,test,reload,sound:sound),icon:const Icon(Icons.play_arrow),label:const Text('Attempt as test')),
          if('${record['publicSourceUrl']??record['source']??''}'.isNotEmpty)OutlinedButton.icon(onPressed:openSource,icon:const Icon(Icons.open_in_new),label:const Text('Open document')),
        ]),
        const TitleText('Questions'),
        ...questions.asMap().entries.map((entry){
          final q=entry.value;
          final subject='${q['subjectId']??''}';
          return Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Wrap(spacing:7,runSpacing:5,children:[
              Chip(label:Text('Q${entry.key+1}')),
              if(subject.isNotEmpty)Chip(label:Text(subjectLabel(subject))),
              if('${q['topic']??''}'.isNotEmpty)Chip(label:Text('${q['topic']}')),
            ]),
            const SizedBox(height:8),
            Text('${q['question']}',style:const TextStyle(fontSize:17,fontWeight:FontWeight.w900,height:1.35)),
            const SizedBox(height:8),
            ...List<dynamic>.from(q['options']??[]).asMap().entries.map((o)=>Padding(
              padding:const EdgeInsets.symmetric(vertical:3),
              child:Text('${String.fromCharCode(65+o.key)}. ${o.value}'),
            )),
          ]));
        }),
        if(test!=null)...[
          const SizedBox(height:12),
          FilledButton(onPressed:()=>instructions(c,test,reload,sound:sound),child:const Text('Attempt this question set →')),
        ],
      ]),
    );
  }
}


class TestsPage extends StatefulWidget{
  final List<Map<String,dynamic>>tests;final List<dynamic>results;final VoidCallback reload;final bool sound;
  const TestsPage({super.key,required this.tests,required this.results,required this.reload,required this.sound});
  @override State<TestsPage>createState()=>_TestsPage();
}
class _TestsPage extends State<TestsPage>{
  String query='',status='all';
  @override Widget build(BuildContext c){
    final completed=widget.results.map((r)=>r['baseTestId']??r['testId']).toSet();
    final rows=widget.tests.where((t){
      final text='${t['title']} ${t['description']} ${t['category']}'.toLowerCase();
      final matches=text.contains(query.toLowerCase());
      final done=completed.contains(t['id']);
      return matches&&(status=='all'||status=='completed'&&done||status=='new'&&!done);
    }).toList();
    return ListView(padding:const EdgeInsets.all(18),children:[
      const Text('Practice tests',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
      const Text('Search and filter tests for your selected examination.',style:TextStyle(color:muted)),
      const SizedBox(height:14),
      TextField(decoration:const InputDecoration(prefixIcon:Icon(Icons.search),hintText:'Search tests'),onChanged:(v)=>setState(()=>query=v)),
      const SizedBox(height:10),
      DropdownButtonFormField<String>(
        value:status,
        decoration:const InputDecoration(labelText:'Attempt status'),
        items:const[
          DropdownMenuItem(value:'all',child:Text('All attempts')),
          DropdownMenuItem(value:'new',child:Text('Not attempted')),
          DropdownMenuItem(value:'completed',child:Text('Completed')),
        ],
        onChanged:(v)=>setState(()=>status=v??'all'),
      ),
      const SizedBox(height:16),
      if(rows.isEmpty)const Box(child:Text('No tests match the current filters.'))
      else ...rows.map((t)=>TestCard(t:t,tap:()=>instructions(c,t,widget.reload,sound:widget.sound))),
    ]);
  }
}

class DiagnosticPage extends StatelessWidget{
  final Data d;final VoidCallback reload;final bool sound;
  const DiagnosticPage({super.key,required this.d,required this.reload,this.sound=true});
  @override Widget build(BuildContext c)=>ListView(
    padding:const EdgeInsets.all(18),
    children:[
      const Text('Free Diagnostic Test',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
      const Text('Choose one examination. The report will show subject scores and preparation priorities.',style:TextStyle(color:muted)),
      const SizedBox(height:16),
      ...d.exams.map((exam){
        final matches=d.tests.where((t)=>t['type']=='diagnostic'&&t['examId']==exam['id']&&t['available']==true).toList();
        final paper=matches.isEmpty?null:matches.first;
        return Box(child:Row(children:[
          CircleAvatar(backgroundColor:const Color(0xffe8f5ef),child:Icon(paper==null?Icons.schedule:Icons.health_and_safety_outlined,color:blue)),
          const SizedBox(width:12),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${exam['name']}',style:const TextStyle(fontWeight:FontWeight.w900)),
            Text('${exam['authority']}',style:const TextStyle(color:muted)),
            Text(paper==null?'Coming soon':'${(paper['questions']as List).length} questions · ${((paper['timing']['totalSeconds']as num)/60).round()} minutes'),
          ])),
          if(paper!=null)FilledButton(onPressed:()=>instructions(c,paper,reload,sound:sound),child:const Text('Select')),
        ]));
      }),
    ],
  );
}

class DeveloperCredit extends StatelessWidget{
  const DeveloperCredit({super.key});
  @override Widget build(BuildContext c)=>Padding(
    padding:const EdgeInsets.symmetric(vertical:16),
    child:Center(child:Text.rich(
      const TextSpan(children:[
        TextSpan(text:'Developed and maintained by '),
        TextSpan(text:'Champak Roy',style:TextStyle(fontWeight:FontWeight.w900)),
      ]),
      textAlign:TextAlign.center,
      style:const TextStyle(color:muted,fontSize:12),
    )),
  );
}

class GuidePage extends StatelessWidget{
  const GuidePage({super.key});
  @override Widget build(BuildContext c)=>Scaffold(
    appBar:AppBar(title:const Text('How to use')),
    body:ListView(padding:const EdgeInsets.all(18),children:[
      const Text('Student guide',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
      const Text('Follow this sequence for a clear preparation workflow.',style:TextStyle(color:muted)),
      const SizedBox(height:16),
      const Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        GuideStep(1,'Choose your examination','Sign in and select the examination you want to focus on.'),
        GuideStep(2,'Review the syllabus','Use the exam page to understand subjects and topics.'),
        GuideStep(3,'Review previous papers','Open validated question sets to read every available question and option.'),
        GuideStep(4,'Practise by subject and topic','Use focused practice before attempting longer tests.'),
        GuideStep(5,'Attempt question sets and tests','Validated question sets can be attempted through the same timer, autosave, review and result system.'),
        GuideStep(6,'Check your results','Completed results are saved to your account and synced across the website and app.'),
        GuideStep(7,'Retake weak areas','Retake wrong, unanswered or all questions with fresh shuffling where supported.'),
        GuideStep(8,'Resume saved attempts','Active attempts are saved automatically on this device.'),
      ])),
      const DeveloperCredit(),
    ]),
  );
}

class MorePage extends StatelessWidget{
  final Data d;final Map<String,dynamic>u,exam;final bool sound;
  final Future<void> Function() onSound;final VoidCallback onGuide,onChangeGoal;
  const MorePage({super.key,required this.d,required this.u,required this.exam,required this.sound,required this.onSound,required this.onGuide,required this.onChangeGoal});
  @override Widget build(BuildContext c)=>ListView(padding:const EdgeInsets.all(18),children:[
    const Text('More',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
    const SizedBox(height:14),
    Box(child:Column(children:[
      CircleAvatar(radius:36,backgroundColor:mint,foregroundColor:forest,child:Text('${u['name']}'[0].toUpperCase(),style:const TextStyle(fontSize:28,fontWeight:FontWeight.w900))),
      const SizedBox(height:8),
      Text('${u['name']}',style:const TextStyle(fontSize:20,fontWeight:FontWeight.w900)),
      Text('${u['email']}',style:const TextStyle(color:muted)),
      if('${u['mobile']??''}'.isNotEmpty)Text('${u['mobile']}',style:const TextStyle(color:muted)),
    ])),
    Box(child:ListTile(contentPadding:EdgeInsets.zero,leading:const Icon(Icons.flag_outlined,color:blue),title:const Text('Primary exam',style:TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('${exam['name']}'),trailing:TextButton(onPressed:onChangeGoal,child:const Text('Change')))),
    Box(child:SwitchListTile(contentPadding:EdgeInsets.zero,value:sound,onChanged:(_)=>onSound(),secondary:const Icon(Icons.volume_up_outlined,color:blue),title:const Text('Test sounds',style:TextStyle(fontWeight:FontWeight.w800)))),
    Box(tap:onGuide,child:const ListTile(contentPadding:EdgeInsets.zero,leading:Icon(Icons.menu_book_outlined,color:blue),title:Text('How to use',style:TextStyle(fontWeight:FontWeight.w800)),trailing:Icon(Icons.chevron_right))),
    OutlinedButton.icon(
      onPressed:()async{
        final token=await Store.string('token');
        if(token!=null){try{await Api.auth('logout',body:{},token:token);}catch(_){}}
        await Store.del('token');await Store.del('user');Store.scope='guest';
        if(c.mounted)Navigator.pushAndRemoveUntil(c,MaterialPageRoute(builder:(_)=>const Boot()),(_)=>false);
      },
      icon:const Icon(Icons.logout),label:const Text('Sign out'),
    ),
    const DeveloperCredit(),
  ]);
}

void instructions(BuildContext c,Map<String,dynamic>t,VoidCallback done,{bool sound=true})=>
  Navigator.push(c,MaterialPageRoute(builder:(_)=>Instructions(t:t,done:done,sound:sound)));

class Instructions extends StatefulWidget{
  final Map<String,dynamic>t;final VoidCallback done;final bool sound;
  const Instructions({super.key,required this.t,required this.done,this.sound=true});
  @override State<Instructions>createState()=>_Instructions();
}
class _Instructions extends State<Instructions>{
  late String mode='${widget.t['defaultMode']??'total-timed'}';
  late String feedback='${widget.t['feedbackMode']??'on-completion'}';
  String markingMode='default';
  bool accepted=false;
  late final TextEditingController correct,wrong,blank;
  @override void initState(){
    super.initState();
    final m=Map<String,dynamic>.from(widget.t['marking']??{});
    correct=TextEditingController(text:'${m['correct']??widget.t['questions']?[0]?['marks']??1}');
    wrong=TextEditingController(text:'${m['incorrect']??-NumberTools.numValue(widget.t['negativeMarking'])}');
    blank=TextEditingController(text:'${m['unanswered']??0}');
  }
  @override void dispose(){correct.dispose();wrong.dispose();blank.dispose();super.dispose();}
  void start(){
    if(!accepted)return;
    final diagnostic=widget.t['type']=='diagnostic';
    final copy=Map<String,dynamic>.from(jsonDecode(jsonEncode(widget.t)));
    Map<String,dynamic> marking=Map<String,dynamic>.from(widget.t['marking']??{
      'correct':null,'incorrect':-NumberTools.numValue(widget.t['negativeMarking']),'unanswered':0
    });
    var selectedMode=diagnostic?'default':markingMode;
    if(!diagnostic&&markingMode=='no-negative'){
      marking={...marking,'incorrect':0,'unanswered':0};
    }else if(!diagnostic&&markingMode=='custom'){
      final c=double.tryParse(correct.text),w=double.tryParse(wrong.text),u=double.tryParse(blank.text);
      if(c==null||c<=0||w==null||w>0||u==null||u<0||u>c){
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Check the custom marking values.')));
        return;
      }
      marking={'correct':c,'incorrect':w,'unanswered':u};
    }
    copy['_markingMode']=selectedMode;
    copy['_marking']=marking;
    copy['_sound']=widget.sound;
    Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>TestPage(
      t:copy,
      mode:diagnostic?'total-timed':mode,
      feedback:diagnostic?'on-completion':feedback,
      done:widget.done,
      sound:widget.sound,
    )));
  }
  @override Widget build(BuildContext c){
    final diagnostic=widget.t['type']=='diagnostic';
    final marking=Map<String,dynamic>.from(widget.t['marking']??{});
    return Scaffold(
      appBar:AppBar(title:Text(diagnostic?'Diagnostic instructions':'Test instructions')),
      body:ListView(padding:const EdgeInsets.fromLTRB(20,20,20,80),children:[
        Pill(diagnostic?'FREE DIAGNOSTIC TEST':'BEFORE YOU BEGIN'),
        const SizedBox(height:8),
        Text('${widget.t['title']}',style:const TextStyle(fontSize:27,fontWeight:FontWeight.w900)),
        Text('${widget.t['description']}',style:const TextStyle(color:muted)),
        const TitleText('Paper details'),
        Wrap(spacing:8,runSpacing:8,children:[
          Chip(label:Text('${(widget.t['questions']as List).length} questions')),
          Chip(label:Text('${widget.t['totalMarks']} marks')),
          Chip(label:Text('${((widget.t['timing']['totalSeconds']as num)/60).round()} minutes')),
          if(diagnostic)Chip(label:Text('+${marking['correct']} / ${marking['incorrect']} / ${marking['unanswered']}')),
        ]),
        if(diagnostic)...[
          const TitleText('Assessment rules'),
          const Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('• One whole-paper timer; submission is automatic when time ends.'),
            Text('• Answers and explanations appear after submission.'),
            Text('• Progress is saved automatically and can be resumed.'),
            Text('• Diagnostic timer, feedback and marking rules are fixed.'),
          ])),
        ]else...[
          const TitleText('Timing mode'),
          SegmentedButton<String>(
            segments:const[
              ButtonSegment(value:'total-timed',label:Text('Total')),
              ButtonSegment(value:'question-timed',label:Text('Per question')),
              ButtonSegment(value:'untimed',label:Text('Untimed')),
            ],
            selected:{mode},onSelectionChanged:(v)=>setState(()=>mode=v.first),
          ),
          const TitleText('Answer checking'),
          RadioListTile<String>(value:'on-completion',groupValue:feedback,title:const Text('After full submission'),subtitle:const Text('Results stay hidden during the test'),onChanged:(v)=>setState(()=>feedback=v!)),
          RadioListTile<String>(value:'per-question',groupValue:feedback,title:const Text('After every question'),subtitle:const Text('Immediate correctness and explanation'),onChanged:(v)=>setState(()=>feedback=v!)),
          const TitleText('Marking setup'),
          DropdownButtonFormField<String>(
            value:markingMode,
            decoration:const InputDecoration(labelText:'Scoring for this attempt'),
            items:const[
              DropdownMenuItem(value:'default',child:Text('Suggested marks')),
              DropdownMenuItem(value:'no-negative',child:Text('No negative marking')),
              DropdownMenuItem(value:'custom',child:Text('Custom marks')),
            ],
            onChanged:(v)=>setState(()=>markingMode=v??'default'),
          ),
          if(markingMode=='custom')...[
            const SizedBox(height:10),
            TextField(controller:correct,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Correct marks')),
            const SizedBox(height:8),
            TextField(controller:wrong,keyboardType:const TextInputType.numberWithOptions(decimal:true,signed:true),decoration:const InputDecoration(labelText:'Wrong marks (0 or negative)')),
            const SizedBox(height:8),
            TextField(controller:blank,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Unanswered marks')),
          ],
          const TitleText('Test rules'),
          const Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('• Progress is saved automatically.'),
            Text('• Total-timed tests submit automatically when time ends.'),
            Text('• Per-question timing moves ahead when time expires.'),
            Text('• Questions can be marked for review.'),
          ])),
        ],
        CheckboxListTile(
          value:accepted,
          onChanged:(v)=>setState(()=>accepted=v??false),
          title:const Text('I have read the instructions and am ready to begin.'),
          controlAffinity:ListTileControlAffinity.leading,
          contentPadding:EdgeInsets.zero,
        ),
        FilledButton(onPressed:accepted?start:null,child:Text(diagnostic?'Start diagnostic →':'Start test →')),
      ]),
    );
  }
}

class TestPage extends StatefulWidget{
  final Map<String,dynamic>t;final String mode,feedback;final Map<String,dynamic>?saved;final VoidCallback done;final bool sound;
  const TestPage({super.key,required this.t,required this.mode,required this.feedback,required this.done,this.saved,this.sound=true});
  @override State<TestPage>createState()=>_TestPage();
}
class _TestPage extends State<TestPage>{
  int i=0,sec=0,elapsed=0;
  Timer? timer;
  late List<int?> ans;
  late List<bool> checked,review;
  late int startedAt;
  List<Map<String,dynamic>>get qs=>List<Map<String,dynamic>>.from(widget.t['questions']);
  Map<String,dynamic>get marking=>Map<String,dynamic>.from(widget.t['_marking']??widget.t['marking']??{
    'correct':null,'incorrect':-NumberTools.numValue(widget.t['negativeMarking']),'unanswered':0
  });
  String get markingMode=>'${widget.t['_markingMode']??'default'}';

  @override void initState(){
    super.initState();
    i=NumberTools.intValue(widget.saved?['current']);
    ans=widget.saved==null?List<int?>.filled(qs.length,null):List<int?>.from(widget.saved!['answers']);
    checked=widget.saved==null?List<bool>.filled(qs.length,false):List<bool>.from(widget.saved!['checked']);
    review=widget.saved==null?List<bool>.filled(qs.length,false):List<bool>.from(widget.saved!['review']);
    elapsed=NumberTools.intValue(widget.saved?['elapsed']);
    startedAt=NumberTools.intValue(widget.saved?['startedAt']);
    if(startedAt==0)startedAt=DateTime.now().millisecondsSinceEpoch;
    sec=widget.saved==null?initial():NumberTools.intValue(widget.saved!['seconds']);
    clock();save();
  }
  int initial()=>widget.mode=='total-timed'
    ?NumberTools.intValue(widget.t['timing']['totalSeconds'])
    :widget.mode=='question-timed'
      ?NumberTools.intValue(widget.t['timing']['questionSeconds'])
      :0;
  void tone(){
    if(widget.sound)SystemSound.play(SystemSoundType.click);
  }
  void clock(){
    timer=Timer.periodic(const Duration(seconds:1),(_){
      if(!mounted)return;
      if(widget.mode=='untimed')elapsed++;
      else if(sec>0)sec--;
      else timeout();
      if(mounted)setState((){});
      if((elapsed+sec)%5==0)save();
    });
  }
  void timeout(){
    if(widget.mode=='total-timed'||i==qs.length-1){finish(auto:true);}
    else{
      i++;
      if(widget.mode=='question-timed')sec=NumberTools.intValue(widget.t['timing']['questionSeconds']);
      save();
    }
  }
  Future<void>save()=>Store.set('active',{
    'testId':widget.t['id'],'test':widget.t,'title':widget.t['title'],
    'mode':widget.mode,'feedback':widget.feedback,'current':i,
    'answers':ans,'checked':checked,'review':review,'seconds':sec,'elapsed':elapsed,'startedAt':startedAt
  });
  void next(){
    if(widget.feedback=='per-question'&&!checked[i]){
      if(ans[i]==null){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Choose an answer before checking it.')));return;}
      setState(()=>checked[i]=true);tone();save();return;
    }
    if(i==qs.length-1){widget.t['type']=='diagnostic'?finish():confirm();return;}
    setState((){
      i++;
      if(widget.mode=='question-timed')sec=NumberTools.intValue(widget.t['timing']['questionSeconds']);
    });
    save();
  }
  void confirm()=>showDialog(
    context:context,
    builder:(c)=>AlertDialog(
      title:const Text('Submit this test?'),
      content:Text('${ans.where((x)=>x!=null).length} answered • ${ans.where((x)=>x==null).length} unanswered • ${review.where((x)=>x).length} for review'),
      actions:[
        TextButton(onPressed:()=>Navigator.pop(c),child:const Text('Continue')),
        FilledButton(onPressed:(){Navigator.pop(c);finish();},child:const Text('Submit')),
      ],
    ),
  );
  Future<void>finish({bool auto=false})async{
    timer?.cancel();
    int right=0,wrongCount=0;
    num score=0,totalMarks=0;
    final topics=<String,Map<String,int>>{};
    for(var x=0;x<qs.length;x++){
      final q=qs[x];
      final ok=ans[x]==q['correctOption'];
      final attempted=ans[x]!=null;
      final correctMarks=markingMode=='custom'
        ?NumberTools.numValue(marking['correct'])
        :NumberTools.numValue(q['marks']??marking['correct']??1);
      totalMarks+=correctMarks;
      if(ok){right++;score+=correctMarks;}
      else if(attempted){wrongCount++;score+=NumberTools.numValue(marking['incorrect']);}
      else{score+=NumberTools.numValue(marking['unanswered']);}
      final topic='${q['topic']??'General'}';
      topics.putIfAbsent(topic,()=>{'correct':0,'total':0});
      topics[topic]!['total']=topics[topic]!['total']!+1;
      if(ok)topics[topic]!['correct']=topics[topic]!['correct']!+1;
    }
    final percent=totalMarks<=0?0:max(0,((score/totalMarks)*100).round());
    final result={
      'id':'result-${DateTime.now().millisecondsSinceEpoch}',
      'title':widget.t['title'],'testId':widget.t['id'],'baseTestId':widget.t['baseTestId']??widget.t['id'],
      'type':widget.t['type']??'practice','examId':widget.t['examId']??(widget.t['examIds']as List?)?.first,
      'correct':right,'incorrect':wrongCount,'unanswered':qs.length-right-wrongCount,
      'score':double.parse(score.toStringAsFixed(2)),'totalMarks':double.parse(totalMarks.toStringAsFixed(2)),
      'percent':percent,'passed':percent>=NumberTools.intValue(widget.t['passPercent'],fallback:40),
      'topicScores':topics,'topics':topics,'answers':ans,'questions':qs,
      'date':DateTime.now().toIso8601String(),'autoSubmitted':auto,
      'timeSeconds':max(1,((DateTime.now().millisecondsSinceEpoch-startedAt)/1000).floor()),
      'marking':marking,'markingMode':markingMode,
    };
    final all=await Store.list('results');
    all.insert(0,result);
    await Store.set('results',all.take(500).toList());
    await saveResultToServer(result);
    await Store.del('active');
    widget.done();
    if(mounted)Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>ResultPage(t:widget.t,r:Map<String,dynamic>.from(result),done:widget.done,sound:widget.sound)));
  }
  void palette()=>showModalBottomSheet(
    context:context,
    builder:(c)=>SafeArea(child:Padding(
      padding:const EdgeInsets.all(16),
      child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Question navigator',style:TextStyle(fontSize:20,fontWeight:FontWeight.w900)),
        const SizedBox(height:12),
        Wrap(spacing:8,runSpacing:8,children:List.generate(qs.length,(x)=>FilledButton.tonal(
          onPressed:(){Navigator.pop(c);setState(()=>i=x);if(widget.mode=='question-timed')sec=NumberTools.intValue(widget.t['timing']['questionSeconds']);save();},
          style:FilledButton.styleFrom(backgroundColor:x==i?mint:ans[x]!=null?const Color(0xffdcefe7):review[x]?const Color(0xffffe9b0):null),
          child:Text('${x+1}'),
        ))),
      ]),
    )),
  );
  @override void dispose(){timer?.cancel();super.dispose();}
  String get time{
    final v=widget.mode=='untimed'?elapsed:sec;
    return '${widget.mode=='untimed'?'Elapsed':'Remaining'} ${(v~/60).toString().padLeft(2,'0')}:${(v%60).toString().padLeft(2,'0')}';
  }
  @override Widget build(BuildContext c){
    final q=qs[i];
    final locked=widget.feedback=='per-question'&&checked[i];
    final correctIndex=NumberTools.intValue(q['correctOption']);
    return PopScope(
      canPop:false,
      child:Scaffold(
        appBar:AppBar(
          leading:IconButton(onPressed:()async{await save();if(c.mounted)Navigator.pop(c);},icon:const Icon(Icons.close)),
          title:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${widget.t['title']}',style:const TextStyle(fontSize:14,fontWeight:FontWeight.w800)),
            Text('Question ${i+1} of ${qs.length}',style:const TextStyle(fontSize:11)),
          ]),
          actions:[
            TextButton(onPressed:palette,child:Text(time,style:const TextStyle(fontWeight:FontWeight.w900))),
          ],
        ),
        body:ListView(padding:const EdgeInsets.all(18),children:[
          LinearProgressIndicator(value:(i+1)/qs.length),
          const SizedBox(height:20),
          Text('${q['topic']} · ${markingMode=='custom'?marking['correct']:q['marks']??marking['correct']??1} marks',style:const TextStyle(color:blue,fontWeight:FontWeight.w800)),
          const SizedBox(height:8),
          Text('${q['question']}',style:const TextStyle(fontSize:22,fontWeight:FontWeight.w900,height:1.3)),
          if(q['code']!=null)Container(
            margin:const EdgeInsets.only(top:12),padding:const EdgeInsets.all(14),
            decoration:BoxDecoration(color:ink,borderRadius:BorderRadius.circular(14)),
            child:Text('${q['code']}',style:const TextStyle(color:Colors.white,fontFamily:'monospace')),
          ),
          const SizedBox(height:14),
          ...List<String>.from(q['options']).asMap().entries.map((o){
            final selected=ans[i]==o.key;
            Color? color;
            if(locked&&o.key==correctIndex)color=Colors.green.shade50;
            if(locked&&selected&&o.key!=correctIndex)color=Colors.red.shade50;
            return Card(
              color:color,
              child:RadioListTile<int>(
                value:o.key,groupValue:ans[i],
                onChanged:locked?null:(v){setState(()=>ans[i]=v);tone();save();},
                title:Text('${String.fromCharCode(65+o.key)}. ${o.value}',style:const TextStyle(fontWeight:FontWeight.w600)),
              ),
            );
          }),
          if(locked)Box(
            color:ans[i]==correctIndex?const Color(0xffe8f5ef):const Color(0xffffeeee),
            child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text(ans[i]==correctIndex?'Correct answer':'Incorrect answer',style:const TextStyle(fontWeight:FontWeight.w900)),
              Text('${q['explanation']}'),
            ]),
          ),
          const SizedBox(height:10),
          Wrap(spacing:8,runSpacing:8,alignment:WrapAlignment.spaceBetween,children:[
            OutlinedButton(onPressed:locked?null:()=>setState(()=>ans[i]=null),child:const Text('Clear')),
            OutlinedButton.icon(onPressed:(){setState(()=>review[i]=!review[i]);save();},icon:Icon(review[i]?Icons.bookmark:Icons.bookmark_border),label:Text(review[i]?'Marked':'Review')),
            FilledButton(onPressed:next,child:Text(widget.feedback=='per-question'&&!locked?'Check answer':i==qs.length-1?'Submit':'Save & next')),
          ]),
        ]),
      ),
    );
  }
}

class ResultPage extends StatelessWidget{
  final Map<String,dynamic>t,r;final VoidCallback done;final bool sound;
  const ResultPage({super.key,required this.t,required this.r,required this.done,this.sound=true});
  List<int?>get ans=>List<int?>.from(r['answers']??[]);
  List<Map<String,dynamic>>get questions=>List<Map<String,dynamic>>.from(r['questions']??t['questions']??[]);
  List<Map<String,dynamic>>pick(String mode)=>questions.asMap().entries.where((e){
    final a=e.key<ans.length?ans[e.key]:null;
    final wrong=a!=null&&a!=e.value['correctOption'];
    return mode=='all'||mode=='unanswered'&&a==null||mode=='review'&&(a==null||wrong)||mode=='wrong'&&wrong;
  }).map((e)=>e.value).toList();
  Map<String,dynamic>mixed(String mode){
    final random=Random(),selected=pick(mode)..shuffle(random);
    final qs=selected.map((source){
      final q=Map<String,dynamic>.from(jsonDecode(jsonEncode(source)));
      final opts=List<dynamic>.from(q['options']);
      final oldCorrect=NumberTools.intValue(q['correctOption']);
      final pairs=List.generate(opts.length,(i)=>{'value':opts[i],'old':i})..shuffle(random);
      q['options']=pairs.map((x)=>x['value']).toList();
      q['correctOption']=pairs.indexWhere((x)=>x['old']==oldCorrect);
      return q;
    }).toList();
    final copy=Map<String,dynamic>.from(jsonDecode(jsonEncode(t)));
    final base=t['baseTestId']??t['id'];
    copy['id']='$base-retake-${DateTime.now().millisecondsSinceEpoch}';
    copy['baseTestId']=base;copy['title']='${t['title']} — retake';copy['questions']=qs;
    copy['_marking']=r['marking'];copy['_markingMode']=r['markingMode'];
    return copy;
  }
  void retake(BuildContext c,String mode){
    if(pick(mode).isEmpty)return;
    instructions(c,mixed(mode),done,sound:sound);
  }
  @override Widget build(BuildContext c){
    final diagnostic=r['type']=='diagnostic';
    final topics=Map<String,dynamic>.from(r['topicScores']??r['topics']??{});
    String? weak;
    for(final k in topics.keys){
      if(weak==null||NumberTools.ratio(topics[k])<NumberTools.ratio(topics[weak]))weak=k;
    }
    final attempted=NumberTools.intValue(r['correct'])+NumberTools.intValue(r['incorrect']);
    final accuracy=attempted==0?0:(NumberTools.intValue(r['correct'])/attempted*100).round();
    return Scaffold(
      appBar:AppBar(title:Text(diagnostic?'Diagnostic report':'Result and next step')),
      body:ListView(padding:const EdgeInsets.fromLTRB(20,20,20,80),children:[
        Center(child:SizedBox(width:155,height:155,child:Stack(alignment:Alignment.center,children:[
          SizedBox.expand(child:CircularProgressIndicator(value:NumberTools.numValue(r['percent'])/100,strokeWidth:14,backgroundColor:const Color(0xffe2e9f3))),
          Column(mainAxisSize:MainAxisSize.min,children:[
            Text('${r['percent']}%',style:const TextStyle(fontSize:31,fontWeight:FontWeight.w900)),
            Text('${r['score']}/${r['totalMarks']}',style:const TextStyle(fontSize:11)),
          ]),
        ]))),
        const SizedBox(height:16),
        Text(diagnostic?'Diagnostic report card':'Your result is ready',textAlign:TextAlign.center,style:const TextStyle(fontSize:26,fontWeight:FontWeight.w900)),
        Text('${r['title']}',textAlign:TextAlign.center,style:const TextStyle(color:muted)),
        const SizedBox(height:15),
        Row(children:[
          Expanded(child:Stat('${r['correct']}','Correct')),const SizedBox(width:8),
          Expanded(child:Stat('${r['incorrect']}','Incorrect')),const SizedBox(width:8),
          Expanded(child:Stat('${r['unanswered']}','Skipped')),
        ]),
        if(diagnostic)...[
          const TitleText('Diagnostic summary'),
          Row(children:[
            Expanded(child:Stat('$accuracy%','Accuracy')),const SizedBox(width:8),
            Expanded(child:Stat('$attempted/${questions.length}','Attempted')),const SizedBox(width:8),
            Expanded(child:Stat(formatSeconds(NumberTools.intValue(r['timeSeconds'])),'Time')),
          ]),
        ],
        const TitleText('Subject / topic performance'),
        ...topics.entries.map((entry){
          final score=Map<String,dynamic>.from(entry.value);
          final total=NumberTools.intValue(score['total']);
          final correct=NumberTools.intValue(score['correct']);
          final percent=total==0?0:(correct/total*100).round();
          return Padding(padding:const EdgeInsets.only(bottom:10),child:Column(children:[
            Row(children:[Expanded(child:Text(entry.key,style:const TextStyle(fontWeight:FontWeight.w700))),Text('$correct/$total · $percent%')]),
            const SizedBox(height:4),LinearProgressIndicator(value:total==0?0:percent/100),
          ]));
        }),
        if(weak!=null)...[
          const TitleText('Recommended next step'),
          Box(color:const Color(0xffe8f5ef),child:Text('Review $weak, then attempt focused practice again.',style:const TextStyle(fontSize:17,fontWeight:FontWeight.w800))),
        ],
        if(!diagnostic)...[
          const TitleText('Retake questions'),
          const Text('Questions and answer options are reshuffled for each retake.',style:TextStyle(color:muted)),
          const SizedBox(height:10),
          Wrap(spacing:8,runSpacing:8,children:[
            OutlinedButton(onPressed:pick('unanswered').isEmpty?null:()=>retake(c,'unanswered'),child:Text('Unanswered (${pick('unanswered').length})')),
            OutlinedButton(onPressed:pick('review').isEmpty?null:()=>retake(c,'review'),child:Text('Unanswered + wrong (${pick('review').length})')),
            OutlinedButton(onPressed:pick('wrong').isEmpty?null:()=>retake(c,'wrong'),child:Text('Wrong (${pick('wrong').length})')),
            FilledButton(onPressed:()=>retake(c,'all'),child:Text('All (${pick('all').length})')),
          ]),
        ]else...[
          const TitleText('Focus areas'),
          Box(child:Text(weak==null?'Review unanswered questions and take more practice.':'Begin with $weak, then retake the diagnostic after further practice.')),
          FilledButton(onPressed:()=>instructions(c,t,done,sound:sound),child:const Text('Retake diagnostic')),
        ],
        const TitleText('Review answers'),
        ...questions.asMap().entries.map((e){
          final a=e.key<ans.length?ans[e.key]:null;
          final correct=NumberTools.intValue(e.value['correctOption']);
          return Box(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${e.key+1}. ${e.value['question']}',style:const TextStyle(fontWeight:FontWeight.w800)),
            const SizedBox(height:5),
            Text(a==null?'Not answered':'Your answer: ${e.value['options'][a]}'),
            Text('Correct: ${e.value['options'][correct]}',style:const TextStyle(color:Colors.green)),
            Text('${e.value['explanation']}',style:const TextStyle(color:muted)),
          ]));
        }),
        FilledButton(onPressed:()=>Navigator.pop(c),child:const Text('Return')),
      ]),
    );
  }
}

class ResultsPage extends StatelessWidget{
  final List<dynamic>items;final List<Map<String,dynamic>>tests;final VoidCallback reload;final bool sound;
  const ResultsPage({super.key,required this.items,required this.tests,required this.reload,required this.sound});
  Map<String,dynamic>testFor(Map<String,dynamic>r){
    final matches=tests.where((t)=>t['id']==r['testId']||t['id']==r['baseTestId']).toList();
    if(matches.isNotEmpty)return matches.first;
    return {
      'id':r['testId'],'title':r['title'],'questions':r['questions']??[],
      'timing':{'totalSeconds':max(60,NumberTools.intValue(r['timeSeconds'])),'questionSeconds':60},
      'passPercent':40,'marking':r['marking']??{},'type':r['type']??'practice'
    };
  }
  @override Widget build(BuildContext c){
    if(items.isEmpty)return const Center(child:Padding(padding:EdgeInsets.all(24),child:Text('Complete a test to begin measuring progress.')));
    return ListView(padding:const EdgeInsets.all(18),children:[
      const Text('Your results',style:TextStyle(fontSize:28,fontWeight:FontWeight.w900)),
      const Text('Results are saved to your account and available on your signed-in devices.',style:TextStyle(color:muted)),
      const SizedBox(height:14),
      ...items.map((raw){
        final r=Map<String,dynamic>.from(raw);
        return Box(tap:()=>Navigator.push(c,MaterialPageRoute(builder:(_)=>ResultPage(t:testFor(r),r:r,done:reload,sound:sound))),child:Row(children:[
          CircleAvatar(radius:27,backgroundColor:r['passed']==true?const Color(0xffe8f5ef):const Color(0xfffff6df),foregroundColor:r['passed']==true?Colors.green:Colors.orange,child:Text('${r['percent']}%',style:const TextStyle(fontWeight:FontWeight.w900,fontSize:12))),
          const SizedBox(width:12),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('${r['title']}',style:const TextStyle(fontWeight:FontWeight.w900)),
            Text('${dateOnly(r['date'])} · ${r['correct']} correct · ${formatSeconds(NumberTools.intValue(r['timeSeconds']))}',style:const TextStyle(color:muted)),
          ])),
          const Icon(Icons.chevron_right),
        ]));
      }),
    ]);
  }
}

class ExamCard extends StatelessWidget{
  final Map<String,dynamic>e;final VoidCallback? tap;final bool on;
  const ExamCard({super.key,required this.e,required this.tap,this.on=false});
  @override Widget build(BuildContext c){
    final available=e['available']==true;
    return Opacity(
      opacity:available?1:.62,
      child:Box(
        color:on?const Color(0xffe8f5ef):Colors.white,
        tap:available?tap:null,
        child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
          CircleAvatar(backgroundColor:const Color(0xffe8f5ef),child:Icon(on?Icons.check:available?Icons.local_police_outlined:Icons.schedule,color:blue)),
          const SizedBox(width:12),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Row(children:[Expanded(child:Text('${e['name']}',style:const TextStyle(fontSize:17,fontWeight:FontWeight.w900))),if(!available)const Chip(label:Text('Coming soon'))]),
            Text('${e['authority']}',style:const TextStyle(fontSize:12,color:blue)),
            const SizedBox(height:5),
            Text('${e['description']}',style:const TextStyle(color:muted,height:1.35)),
            if(available)...[const SizedBox(height:7),Text('${e['status']}',style:const TextStyle(fontSize:12,fontWeight:FontWeight.w700))],
          ])),
          if(available)const Icon(Icons.chevron_right),
        ]),
      ),
    );
  }
}

class TestCard extends StatelessWidget{
  final Map<String,dynamic>t;final VoidCallback tap;
  const TestCard({super.key,required this.t,required this.tap});
  @override Widget build(BuildContext c)=>Box(
    tap:tap,
    child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Row(children:[Icon(t['type']=='diagnostic'?Icons.health_and_safety_outlined:Icons.assignment_outlined,color:blue),const Spacer(),Chip(label:Text('${t['difficulty']??'Practice'}'))]),
      Text('${t['title']}',style:const TextStyle(fontSize:18,fontWeight:FontWeight.w900)),
      Text('${t['description']}',style:const TextStyle(color:muted)),
      const SizedBox(height:9),
      Text('${(t['questions']as List).length} questions · ${t['totalMarks']} marks · ${((t['timing']['totalSeconds']as num)/60).round()} min',style:const TextStyle(fontWeight:FontWeight.w700)),
      const Align(alignment:Alignment.centerRight,child:Text('View instructions →',style:TextStyle(color:blue,fontWeight:FontWeight.w800))),
    ]),
  );
}

class GuideStep extends StatelessWidget{
  final int n;final String title,description;
  const GuideStep(this.n,this.title,this.description,{super.key});
  @override Widget build(BuildContext c)=>Padding(
    padding:const EdgeInsets.symmetric(vertical:7),
    child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
      CircleAvatar(radius:14,backgroundColor:mint,foregroundColor:forest,child:Text('$n',style:const TextStyle(fontSize:11,fontWeight:FontWeight.w900))),
      const SizedBox(width:10),
      Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        Text(title,style:const TextStyle(fontWeight:FontWeight.w900)),
        Text(description,style:const TextStyle(color:muted)),
      ])),
    ]),
  );
}

class ActionTile extends StatelessWidget{
  final IconData icon;final String title;final VoidCallback tap;
  const ActionTile({super.key,required this.icon,required this.title,required this.tap});
  @override Widget build(BuildContext c)=>Box(tap:tap,child:Column(children:[Icon(icon,color:blue),const SizedBox(height:6),Text(title,style:const TextStyle(fontWeight:FontWeight.w800))]));
}

class Logo extends StatelessWidget{
  final double size;final bool dark;
  const Logo(this.size,{super.key,this.dark=false});
  @override Widget build(BuildContext c)=>Container(
    width:size,height:size,alignment:Alignment.center,
    decoration:BoxDecoration(
      gradient:const LinearGradient(colors:[Color(0xff50e0b7),Color(0xff00856b)]),
      borderRadius:BorderRadius.circular(size*.27),
    ),
    child:Icon(Icons.school,color:const Color(0xff061510),size:size*.55),
  );
}
class Pill extends StatelessWidget{
  final String text;final bool dark;
  const Pill(this.text,{super.key,this.dark=false});
  @override Widget build(BuildContext c)=>Align(
    alignment:Alignment.centerLeft,
    child:Container(
      padding:const EdgeInsets.symmetric(horizontal:10,vertical:5),
      decoration:BoxDecoration(color:dark?Colors.white12:mint.withOpacity(.28),borderRadius:BorderRadius.circular(20)),
      child:Text(text,style:TextStyle(color:dark?mint:forest,fontSize:11,fontWeight:FontWeight.w900)),
    ),
  );
}
class Metric extends StatelessWidget{
  final String v,l;
  const Metric(this.v,this.l,{super.key});
  @override Widget build(BuildContext c)=>Column(children:[
    Text(v,style:const TextStyle(color:mint,fontSize:21,fontWeight:FontWeight.w900)),
    Text(l,style:const TextStyle(color:Colors.white70,fontSize:11)),
  ]);
}
class Box extends StatelessWidget{
  final Widget child;final Color color;final VoidCallback?tap;
  const Box({super.key,required this.child,this.color=Colors.white,this.tap});
  @override Widget build(BuildContext c)=>Card(
    margin:const EdgeInsets.only(bottom:12),color:color,
    shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(18),side:const BorderSide(color:Color(0xffe1e8f3))),
    child:InkWell(onTap:tap,borderRadius:BorderRadius.circular(18),child:Padding(padding:const EdgeInsets.all(16),child:child)),
  );
}
class Stat extends StatelessWidget{
  final String v,l;
  const Stat(this.v,this.l,{super.key});
  @override Widget build(BuildContext c)=>Container(
    padding:const EdgeInsets.symmetric(vertical:14),
    decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(15),border:Border.all(color:const Color(0xffe1e8f3))),
    child:Column(children:[
      Text(v,style:const TextStyle(fontSize:19,fontWeight:FontWeight.w900,color:blue)),
      Text(l,style:const TextStyle(fontSize:11)),
    ]),
  );
}
class TitleText extends StatelessWidget{
  final String t;
  const TitleText(this.t,{super.key});
  @override Widget build(BuildContext c)=>Padding(
    padding:const EdgeInsets.only(top:23,bottom:10),
    child:Text(t,style:const TextStyle(fontSize:19,fontWeight:FontWeight.w900)),
  );
}

class NumberTools{
  static int intValue(dynamic v,{int fallback=0}){
    if(v is int)return v;
    if(v is num)return v.toInt();
    return int.tryParse('${v??''}')??fallback;
  }
  static num numValue(dynamic v,{num fallback=0}){
    if(v is num)return v;
    return num.tryParse('${v??''}')??fallback;
  }
  static double ratio(dynamic value){
    if(value is! Map)return 0;
    final m=Map<String,dynamic>.from(value);
    final total=intValue(m['total']);
    return total==0?0:intValue(m['correct'])/total;
  }
}
String dayPart(){
  final h=DateTime.now().hour;
  return h<12?'morning':h<17?'afternoon':'evening';
}
String dateOnly(dynamic value){
  final s='${value??''}';
  return s.length>=10?s.substring(0,10):s;
}
String formatSeconds(int seconds){
  final safe=max(0,seconds),h=safe~/3600,m=(safe%3600)~/60,s=safe%60;
  return h>0?'${h.toString()}:${m.toString().padLeft(2,'0')}:${s.toString().padLeft(2,'0')}':'${m.toString().padLeft(2,'0')}:${s.toString().padLeft(2,'0')}';
}
