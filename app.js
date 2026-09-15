'use strict';
(() => {
  const config = window.SITE_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const header = $('.site-header'), menu = $('.menu-btn'), nav = $('.main-nav');
  const modal = $('#applyModal'), sheet = $('.apply-sheet'), toast = $('#toast');
  let opener, scrollY = 0, locked = false, timer;
  const webUrl = (value) => {
    try { const u = new URL(value); return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) ? u.href : ''; } catch { return ''; }
  };
  const api = webUrl(config.entryApi), official = webUrl(config.officialEntryUrl);
  function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('show'), 4500); }
  function lock() {
    if (locked) return;
    scrollY = window.scrollY; locked = true;
    const gap = innerWidth - document.documentElement.clientWidth;
    Object.assign(document.body.style, {position:'fixed', top:`-${scrollY}px`, width:'100%', paddingRight:`${gap}px`});
  }
  function unlock() {
    if (!locked) return; locked = false;
    Object.assign(document.body.style,{position:'',top:'',width:'',paddingRight:''});
    const root = document.documentElement, previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto'; window.scrollTo(0,scrollY); root.style.scrollBehavior = previous;
  }
  function inertBackground(active, includeHeader = false) {
    ['main','.site-footer','.mobile-bottom-bar'].forEach(s => { $(s).inert = active; });
    header.inert = active && includeHeader;
  }
  function setMenu(open, returnFocus = true) {
    menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',open ? '关闭菜单' : '打开菜单');
    nav.classList.toggle('open',open); document.body.classList.toggle('menu-open',open);
    inertBackground(open);
    if (open) { lock(); nav.querySelector('a').focus(); } else { unlock(); if (returnFocus) menu.focus({preventScroll:true}); }
  }
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{ if(nav.classList.contains('open')) setMenu(false,false); }));
  window.addEventListener('resize',()=>{ if(innerWidth>1200 && nav.classList.contains('open'))setMenu(false,false); });
  const onScroll=()=>header.classList.toggle('is-light',(locked?scrollY:window.scrollY)>($('.hero')?.offsetHeight || 82)-84);
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
  function openApply(event) {
    if (official) { location.assign(official); return; }
    opener = event?.currentTarget || document.activeElement;
    if (nav.classList.contains('open')) setMenu(false,false);
    lock(); inertBackground(true,true); modal.inert = false;
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open'); sheet.scrollTop = 0;
    $('#modalTitle').focus({preventScroll:true});
  }
  function closeApply() {
    if(!modal.classList.contains('open')) return;
    modal.classList.remove('open'); document.body.classList.remove('modal-open');
    inertBackground(false); unlock(); opener?.focus({preventScroll:true});
    modal.inert = true; modal.setAttribute('aria-hidden','true');
  }
  document.querySelectorAll('[data-open-apply]').forEach(el=>el.addEventListener('click',openApply));
  document.querySelectorAll('[data-close-apply]').forEach(el=>el.addEventListener('click',closeApply));
  const focusables = root => [...root.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length && !el.closest('[inert]'));
  document.addEventListener('keydown',e=>{
    const inModal=modal.classList.contains('open'), inMenu=nav.classList.contains('open');
    if(e.key==='Escape'){ if(inModal)closeApply(); else if(inMenu)setMenu(false); }
    if(e.key==='Tab' && (inModal||inMenu)){
      const list=focusables(inModal?sheet:header), first=list[0], last=list.at(-1);
      if(!first)return;
      if(e.shiftKey && (document.activeElement===first || !list.includes(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey && (document.activeElement===last || !list.includes(document.activeElement))){e.preventDefault();first.focus();}
    }
  });
  function resizeModal(){
    const v=window.visualViewport;
    modal.style.setProperty('--visual-height',`${v?.height || innerHeight}px`);
    modal.style.setProperty('--visual-top',`${v?.offsetTop || 0}px`);
  }
  window.visualViewport?.addEventListener('resize',resizeModal);
  window.visualViewport?.addEventListener('scroll',resizeModal);
  window.addEventListener('resize',resizeModal); resizeModal();
  document.querySelectorAll('[data-entry-form]').forEach(form=>{
    const button=form.querySelector('[type="submit"]'), status=form.querySelector('.form-status');
    const note=form.querySelector('small') || $('.sheet-note');
    if(official && form.id==='applyForm'){
      form.querySelectorAll('label,button,small,.form-status').forEach(el=>el.hidden=true);
      // Explicit display avoids existing grid/flex styles overriding the hidden attribute.
      form.querySelectorAll('[hidden]').forEach(el=>el.style.display='none');
      const link=document.createElement('a'); link.className='external-entry';link.href=official;link.textContent='前往正式报名入口 ↗';form.append(link);
    } else if(!api){
      form.querySelectorAll('input,select').forEach(el=>el.disabled=true);button.disabled=true;button.textContent='报名开放时间即将公布';status.textContent='报名尚未开放，当前不收集或保存个人信息。';
    } else {
      status.textContent='请填写报名意向。作品提交要求以组委会通知为准。';
      note.textContent='提交内容仅用于报名联系，具体信息处理规则以组委会公布的说明为准。';
      $('.sheet-intro').textContent='填写报名意向，作品材料与后续安排以组委会正式通知为准。';
    }
    let submitting=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault(); if(official){location.assign(official);return;}
      if(!api || submitting || !form.reportValidity())return;
      const payload=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,String(v).trim()]));
      if(Object.values(payload).some(v=>!v)){status.dataset.state='error';status.textContent='请完整填写信息，内容不能只有空格。';return;}
      submitting=true;button.disabled=true;button.textContent='提交中…';status.dataset.state='';status.textContent='正在提交，请稍候。';
      const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
        const data=await res.json().catch(()=>null);
        if(!res.ok || data?.success!==true)throw new Error('unconfirmed');
        status.dataset.state='success';status.textContent='报名意向已提交。后续安排请关注组委会通知。';form.reset();
      }catch(error){status.dataset.state='error';status.textContent=error.name==='AbortError'?'提交超时，结果尚未确认。请向组委会核实后再试。':'未能确认提交成功。填写内容已保留，请稍后重试或联系组委会。';}
      finally{clearTimeout(timeout);submitting=false;button.disabled=false;button.textContent='提交报名意向 →';}
    });
  });
  document.querySelectorAll('[data-share]').forEach(button=>button.addEventListener('click',async()=>{
    const url=webUrl(config.siteUrl) || (location.protocol.startsWith('http')?location.href.split('#')[0]:'');
    if(!url){showToast('当前为本地文件，请在网站正式上线后分享链接。');return;}
    if(/MicroMessenger/i.test(navigator.userAgent)){showToast('请点击微信右上角“…”分享给朋友或朋友圈。');return;}
    try{
      if(navigator.share)await navigator.share({title:config.competitionName,text:'探索第五代智能厨房创新设计，赛事安排即将公布。',url});
      else if(navigator.clipboard){await navigator.clipboard.writeText(url);showToast('链接已复制，可粘贴到微信分享。');}
      else showToast('请复制浏览器地址栏中的网站链接进行分享。');
    }catch(error){if(error.name!=='AbortError')showToast('请复制浏览器地址栏中的网站链接进行分享。');}
  }));
  document.querySelectorAll('details').forEach(item=>{
    const update=()=>item.querySelector('summary b') && (item.querySelector('summary b').textContent=item.open?'−':'＋');update();item.addEventListener('toggle',update);
  });
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){nav.querySelectorAll('a').forEach(a=>{if(a.hash==='#'+entry.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
    }),{rootMargin:'-15% 0px -65% 0px'});
    nav.querySelectorAll('a').forEach(a=>{const target=a.hash ? $(a.hash) : null;if(target)observer.observe(target);});
  }
})();

// Native details keep the menu usable without hover on touch devices.
document.querySelectorAll('.nav-group').forEach(group=>group.addEventListener('toggle',()=>{
  if(group.open && innerWidth>1100) document.querySelectorAll('.nav-group').forEach(other=>{if(other!==group)other.open=false;});
}));
document.addEventListener('click',event=>{if(!event.target.closest('.main-nav')) document.querySelectorAll('.nav-group').forEach(g=>g.open=false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.nav-group').forEach(g=>g.open=false);});
