document.addEventListener('DOMContentLoaded',function(){
  var hd=document.getElementById('hd'),bg=document.getElementById('burger'),nav=document.getElementById('nav');
  function onScroll(){hd.classList.toggle('solid',window.scrollY>40)}
  onScroll();window.addEventListener('scroll',onScroll,{passive:true});
  function close(){nav.classList.remove('open');bg.classList.remove('open');bg.setAttribute('aria-expanded','false');bg.setAttribute('aria-label','メニューを開く');document.body.classList.remove('lock');setBg(false)}
  var mainEl=document.getElementById('main');
  function setBg(inert){[mainEl,document.querySelector('footer'),document.getElementById('mbar')].forEach(function(el){if(!el)return;if(inert)el.setAttribute('inert','');else el.removeAttribute('inert')})}
  bg.addEventListener('click',function(){
    var o=nav.classList.toggle('open');bg.classList.toggle('open',o);
    bg.setAttribute('aria-expanded',o);bg.setAttribute('aria-label',o?'メニューを閉じる':'メニューを開く');document.body.classList.toggle('lock',o);
    setBg(o);
  });
  /* メニューを開いている間は Tab がメニュー内を巡回する */
  nav.addEventListener('keydown',function(e){
    if(e.key!=='Tab'||!nav.classList.contains('open'))return;
    var f=[bg].concat([].slice.call(nav.querySelectorAll('a')));
    var first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });
  nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav.classList.contains('open')){close();bg.focus()}});
  window.addEventListener('resize',function(){if(innerWidth>1040)close()});
  var mb=document.getElementById('mbar'),ct=document.getElementById('contact');
  if(mb){
    var ctVisible=false;
    function mbar(){mb.classList.toggle('show',window.scrollY>360&&!ctVisible)}
    if(ct&&'IntersectionObserver' in window){new IntersectionObserver(function(es){ctVisible=es[0].isIntersecting;mbar()},{threshold:.15}).observe(ct)}
    mbar();window.addEventListener('scroll',mbar,{passive:true});
  }
  var els=document.querySelectorAll('.rv');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){io.observe(el)});
  }else els.forEach(function(el){el.classList.add('in')});
  /* ?topic=キー（例 shinchiku）で相談内容を選んでおく。古い形（?topic=リフォーム のような文言）も受け付ける */
  var tp=new URLSearchParams(location.search).get('topic'),sel=document.getElementById('topic');
  if(tp&&sel){for(var i=0;i<sel.options.length;i++){if(sel.options[i].getAttribute('data-key')===tp||sel.options[i].text===tp){sel.selectedIndex=i;break}}}
  /* 電話番号かメールアドレスの、どちらか一方は必須 */
  var ph=document.getElementById('phone'),em=document.getElementById('email');
  if(ph&&em){
    var need=function(){em.setCustomValidity((ph.value.trim()||em.value.trim())?'':'電話番号かメールアドレスのどちらかをご入力ください')};
    ph.addEventListener('input',need);em.addEventListener('input',need);need();
  }
  var cf=document.getElementById('cform');
  if(cf){var sb=cf.querySelector('button[type=submit]'),sl=sb&&sb.firstChild.nodeValue,hp=document.getElementById('hp_note');
    cf.addEventListener('submit',function(e){
      /* 迷惑送信（ボット）対策：人には見えない欄に何か入っていたら、送らずに完了ページへ。空なら、その欄は送信しない */
      if(hp){if(hp.value){e.preventDefault();location.replace('/thanks');return}hp.disabled=true}
      if(sb&&cf.checkValidity()){sb.disabled=true;sb.setAttribute('aria-busy','true');sb.firstChild.nodeValue='送信中…'}
    });
    /* 送信後にブラウザの「戻る」で戻ってもボタンが固まらないように */
    window.addEventListener('pageshow',function(e){if(e.persisted){if(hp)hp.disabled=false;if(sb){sb.disabled=false;sb.removeAttribute('aria-busy');sb.firstChild.nodeValue=sl}}});
  }
});
