(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const cfg = window.DP_CONFIG || {};
  const ic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  // В DOM отображаются только реальные, введённые владельцем контакты.
  if (cfg.phone && /^\+?[0-9 ()-]{8,22}$/.test(cfg.phone)) {
    $$('[data-contact-phone]').forEach(el => { el.textContent = cfg.phone; if (el.tagName === 'A') el.href = 'tel:' + cfg.phone.replace(/[^+0-9]/g,''); });
  }
  if (cfg.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
    $$('[data-contact-email]').forEach(el => { el.textContent = cfg.email; if(el.tagName === 'A') el.href = 'mailto:' + cfg.email; });
  }
  if (cfg.telegram && /^https:\/\/t\.me\/(?:[a-zA-Z0-9_]{5,}|\+[0-9]{8,15})$/.test(cfg.telegram)) {
    $$('[data-contact-telegram]').forEach(el => { el.href = cfg.telegram; el.hidden = false; });
  }
  // Меню для мобильных.
  const toggle = $('[data-menu-toggle]');
  const panel = $('[data-mobile-panel]');
  function closeMenu() { if(!toggle || !panel) return; panel.classList.remove('open'); document.body.classList.remove('nav-open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Открыть меню'); }
  if(toggle && panel) {
    toggle.addEventListener('click', () => { const opened = toggle.getAttribute('aria-expanded') === 'true'; if(opened) closeMenu(); else { panel.classList.add('open'); document.body.classList.add('nav-open'); toggle.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-label','Закрыть меню'); } });
    $$('a',panel).forEach(link => link.addEventListener('click',closeMenu));
    document.addEventListener('keydown', e => { if(e.key==='Escape') closeMenu(); });
    window.addEventListener('resize',()=>{if(innerWidth>780)closeMenu();});
  }
  if('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const obs = new IntersectionObserver((entries)=>{entries.forEach(en=>{if(en.isIntersecting){en.target.classList.add('is-visible');obs.unobserve(en.target);}})}, {threshold:.08,rootMargin:'0px 0px -20px 0px'});
    $$('[data-reveal]').forEach(el => { el.classList.add('reveal'); obs.observe(el); });
  }
  // Примеры макетов в портфолио: фильтрация без обращения к серверу.
  const filters = $$('[data-filter]');
  if(filters.length){filters.forEach(btn=>btn.addEventListener('click',()=>{
    const value=btn.dataset.filter;
    filters.forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    $$('[data-project-tag]').forEach(card=>{card.hidden=value!=='all'&&card.dataset.projectTag!==value;});
  }));}
  // Конфигуратор формирует состав работ и перечень вопросов, но НЕ выдумывает цену.
  const estimate = $('[data-estimate-form]');
  function getEstimate() {
    if(!estimate) return null;
    const d = new FormData(estimate);
    const type = String(d.get('type') || 'Дом / дача');
    const area = Math.max(0,Number(d.get('area'))||0);
    const access=String(d.get('access')||'Не знаю');
    const foundation=String(d.get('foundation')||'Не знаю');
    const waste=String(d.get('waste')||'Да');
    const stage=['Осмотр конструкции и условий участка','Подготовка последовательности и состава работ', 'Демонтаж строения'];
    if(foundation==='Да')stage.push('Демонтаж фундамента');
    if(waste==='Да')stage.push('Погрузка и вывоз строительных отходов');
    stage.push('Финальная проверка объёма работ');
    const complexity=access==='Ограничен' || area>=150 || foundation==='Да' ? 'Требуется детальная оценка' : 'Уточняется по фотографиям и параметрам';
    const msg=`DomPogrom — запрос расчёта\nОбъект: ${type}\nПлощадь: ${area>0?area+' м²':'не указана'}\nПодъезд: ${access}\nФундамент: ${foundation}\nВывоз: ${waste}\n\nТребуется уточнить сроки, расположение объекта и итоговую смету.`;
    return {type,area,access,foundation,waste,stage,complexity,msg};
  }
  function renderEstimate(){
    if(!estimate) return;
    const x=getEstimate();
    const out=$('[data-estimate-list]');
    const level=$('[data-estimate-level]');
    if(out)out.replaceChildren(...x.stage.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));
    if(level)level.textContent=x.complexity;
    const inp=$('[data-estimate-text]'); if(inp)inp.value=x.msg;
  }
  if(estimate){estimate.addEventListener('input',renderEstimate);estimate.addEventListener('change',renderEstimate);renderEstimate();}
  // Форма заявки: адаптер к обработчику на своём домене (без секретов в JS).
  // Пока адрес обработчика пустой, работает только ручное копирование/почтовый клиент.
  const contact = $('[data-contact-form]');
  const params = new URLSearchParams(location.search);
  if (contact && params.has('service')) {
    const select = $('[name="service"]', contact);
    if (select) {
      const target = $$('option', select).find(o => o.value === params.get('service'));
      if (target) select.value = target.value;
    }
  }
  const showStatus=(node,message)=>{if(!node)return;node.textContent=message;node.setAttribute('role','status');};
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText(text);return true;}
    const modal=$('[data-copy-modal]'); const output=$('[data-copy-output]');
    if (modal&&output) {output.value=text;modal.hidden=false;modal.showModal?.();output.focus();output.select();return false;}
    return false;
  }
  const modal=$('[data-copy-modal]');
  if (modal) {modal.addEventListener('click', e=>{if(e.target===modal)modal.close();});$('[data-modal-close]',modal)?.addEventListener('click',()=>modal.close());}
  const endpoint=typeof cfg.formEndpoint==='string' && /^\/api\/[a-zA-Z0-9/_.-]+$/.test(cfg.formEndpoint) ? cfg.formEndpoint : '';
  function buildLeadText(d) {
    return [
      'DomPogrom — новая заявка',
      'Имя: '+(d.get('name')||'не указано'),
      'Телефон: '+(d.get('phone')||'не указан'),
      'Тип работ: '+(d.get('service')||'не выбран'),
      'Населённый пункт: '+(d.get('location')||'не указан'),
      'Площадь: '+(d.get('area') ? d.get('area')+' м²':'не указана'),
      'Подъезд: '+(d.get('access')||'не указан'),
      'Подробности: '+(d.get('description')||'не указаны')
    ].join('\n');
  }
  const maxFile=3*1024*1024;
  function validatePhotos() {
    if(!contact)return true;
    const chosen=$$('[data-lead-photo]',contact).flatMap(el=>Array.from(el.files||[]));
    const total=chosen.reduce((size,file)=>size+file.size,0);
    const valid=chosen.every(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=maxFile)&&total<=6*1024*1024;
    const status=$('[data-photo-status]',contact);
    if(status) status.textContent=!valid ? 'Файлы должны быть JPG, PNG или WebP, до 3 МБ каждый и 6 МБ вместе.' : chosen.length ? 'Выбрано: '+chosen.map(f=>f.name).join(' · ') : 'JPG, PNG или WebP · максимум 3 МБ на фото, 6 МБ суммарно. Для WhatsApp фото нужно добавить в чате отдельно.';
    if(status) status.classList.toggle('input-error',!valid);
    return valid;
  }
  if(contact){
    const phone=$('[name="phone"]',contact);
    const submit=$('[data-lead-submit]',contact);
    const explainer=$('[data-form-explainer]',contact);
    if(endpoint){
      if(submit)submit.firstChild.textContent='Отправить заявку ';
      if(explainer)explainer.textContent='После отправки данные и прикреплённые фото передаются на сервер обработки заявок. Отправка считается успешной только после подтверждения сервера.';
    }
    if(!endpoint && submit && explainer){
      explainer.textContent='WhatsApp откроется с заполненным текстом. Нажмите «Отправить» в мессенджере. Фото прикрепите отдельно. Альтернативы: телефон и email.';
    }
    phone?.addEventListener('input',()=>phone.setCustomValidity(''));
    $$('[data-lead-photo]',contact).forEach(el=>el.addEventListener('change',validatePhotos));
    function validateLead(){
      if(phone){
        phone.setCustomValidity((phone.value.match(/\d/g)||[]).length>=10 ? '' : 'Укажите телефон минимум из 10 цифр.');
      }
      if(!contact.reportValidity())return false;
      if(!validatePhotos()){ $('[data-lead-photo]',contact)?.focus(); return false; }
      return true;
    }
    async function fallbackLead(d){
      const text=buildLeadText(d);
      if(cfg.whatsapp && /^https:\/\/wa\.me\/[0-9]{10,15}$/.test(cfg.whatsapp)) {
        const url=cfg.whatsapp+'?text='+encodeURIComponent(text);
        const opened=window.open(url,'_blank','noopener,noreferrer');
        if(opened) return 'Открыт WhatsApp с текстом. Нажмите «Отправить» в чате. Прикрепите фотографии отдельно.';
        // Some mobile browsers deliberately return null despite opening noopener tabs.
        return 'Открываем WhatsApp. Отправьте подготовленный текст в чате и добавьте фотографии отдельно.';
      }
      if(cfg.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)){
        location.href='mailto:'+cfg.email+'?subject='+encodeURIComponent('Заявка на демонтаж — DomPogrom')+'&body='+encodeURIComponent(text);
        return 'Открыт почтовый клиент. Нужно самостоятельно отправить письмо; приложите фотографии к письму вручную.';
      }
      try { const copied=await copyText(text); return copied?'Текст заявки скопирован. Отправка не настроена, фото не прикреплены.':'Текст заявки подготовлен для копирования. Автоматическая отправка не настроена.'; }
      catch {return 'Не удалось скопировать. Скопируйте текст заявки вручную.';}
    }
    const sendBtn=$('[data-copy-lead]',contact);
    sendBtn?.addEventListener('click',async()=>{
      if(!validateLead())return;
      try {
        const copied=await copyText(buildLeadText(new FormData(contact)));
        showStatus($('[data-contact-status]'),copied?'Текст заявки скопирован. Фотографии не включены.':'Текст заявки подготовлен для копирования. Фотографии не включены.');
      } catch { showStatus($('[data-contact-status]'),'Не удалось скопировать: выделите текст в открывшемся окне.'); }
    });
    contact.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!validateLead())return;
      const d=new FormData(contact);
      const status=$('[data-contact-status]');
      if(d.get('company_website')){showStatus(status,'Проверьте введённые данные.');return;}
      if(!endpoint){showStatus(status,await fallbackLead(d));return;}
      if(submit)submit.disabled=true;
      showStatus(status,'Отправляем заявку…');
      try{
        const response=await fetch(endpoint,{method:'POST',body:d,headers:{'Accept':'application/json'},credentials:'same-origin'});
        const result=await response.json();
        if(!response.ok || result?.ok!==true)throw new Error('Failed to accept lead');
        contact.reset();
        validatePhotos();
        showStatus(status,'Заявка передана в обработку. Мы свяжемся по указанному номеру.');
      } catch {
        showStatus(status,'Не получилось отправить. Данные сохранены в форме: повторите позже или скопируйте заявку кнопкой ниже.');
      } finally {if(submit)submit.disabled=false;}
    });
  }
  const exportEstimate=$('[data-copy-estimate]');
  if(exportEstimate){exportEstimate.addEventListener('click',async()=>{
    const x=getEstimate(); if(!x)return;
    const el=$('[data-estimate-feedback]');
    try { const c=await copyText(x.msg); showStatus(el,c?'Параметры скопированы.':'Параметры подготовлены для копирования.'); }
    catch {showStatus(el,'Скопируйте параметры вручную.');}
  });}
  const estimateToContact=$('[data-estimate-to-contact]');
  if(estimateToContact && estimate) estimateToContact.addEventListener('click',()=>{
    const x=getEstimate(); if(!x)return;
    // Сохраняем только в адресе краткие параметры, не личные данные.
    const p=new URLSearchParams({service:x.type, details:`Площадь: ${x.area||'—'} м²; подъезд: ${x.access}; фундамент: ${x.foundation}; вывоз: ${x.waste}`});
    location.href='contacts.html?'+p.toString();
  });
  if(contact && params.has('details')){const textarea=$('[name="description"]',contact);if(textarea)textarea.value=params.get('details').slice(0,700);}
})();
