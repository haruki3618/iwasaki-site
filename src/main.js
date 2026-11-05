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
  window.addEventListener('resize',function(){if(innerWidth>1180)close()});
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
  var tp=new URLSearchParams(location.search).get('topic'),sel=document.getElementById('topic');
  if(tp&&sel){for(var i=0;i<sel.options.length;i++){if(sel.options[i].text===tp){sel.selectedIndex=i;break}}}
  var cf=document.getElementById('cform');
  if(cf){var sb=cf.querySelector('button[type=submit]'),sl=sb&&sb.firstChild.nodeValue;
    cf.addEventListener('submit',function(){if(sb&&cf.checkValidity()){sb.disabled=true;sb.setAttribute('aria-busy','true');sb.firstChild.nodeValue='送信中…'}});
    /* 送信後にブラウザの「戻る」で戻ってもボタンが固まらないように */
    window.addEventListener('pageshow',function(e){if(e.persisted&&sb){sb.disabled=false;sb.removeAttribute('aria-busy');sb.firstChild.nodeValue=sl}});
  }
});
