const form = document.querySelector('#search-form');
const address = document.querySelector('#address');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const compare = form.querySelector('button');
let countyRequest;
let detailsRequest;
const house = '<div class="loading-house"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m5 19 15-13 15 13M10 16v18h20V16M17 34V23h6v11"/></svg></div>';
function clearSearch() { detailsRequest?.abort(); detailsRequest=null; countyRequest?.abort(); countyRequest = null; results.hidden = true; status.hidden = true; compare.disabled = false; compare.textContent = 'Compare home values >'; }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!address.value.trim()) { address.setCustomValidity('Please enter your property address or parcel number.'); address.reportValidity(); return; }
  clearSearch();
  const request = new AbortController(); countyRequest = request;
  status.hidden = false;
  status.innerHTML = house + '<h2>Looking up your county record</h2><p>Searching Spokane County parcel data…</p>';
  compare.disabled = true; compare.textContent = 'Searching county records…';
  status.scrollIntoView({behavior:'smooth', block:'center'});
  const timeout = setTimeout(() => request.abort('timeout'), 18000);
  try {
    const response = await fetch('/api/county',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:address.value.trim()}),signal:request.signal});
    const data = await response.json();
    if(countyRequest !== request) return;
    if(!response.ok) throw new Error(data.error?.message || 'County search is temporarily unavailable.');
    if(!Array.isArray(data.properties)) throw new Error('The county returned an unexpected response. Please try again.');
    showMatches(data);
  } catch(error) {
    if(countyRequest !== request) return;
    status.innerHTML = '<h2>County lookup unavailable</h2><p>' + escapeHTML(request.signal.aborted ? 'The county search took too long. Please try again.' : error.message) + '</p><p><a class="county-link" href="https://cp.spokanecounty.gov/scout/SCOUTDashboard/" target="_blank" rel="noopener noreferrer">Search directly on SCOUT &gt;</a></p>';
  } finally {
    clearTimeout(timeout);
    if(countyRequest === request) { compare.disabled = false; compare.textContent = 'Compare home values >'; countyRequest = null; }
  }
});
function showMatches(data) {
  if(!data.properties.length) {
    status.innerHTML = '<h2>No matching county records</h2><p>Try the house number and street name without the city, or use the parcel number from your tax statement (for example, 35182.4601).</p><p>Some units and newly created parcels may need to be searched directly on SCOUT.</p><a class="county-link" href="https://cp.spokanecounty.gov/scout/SCOUTDashboard/" target="_blank" rel="noopener noreferrer">Open SCOUT &gt;</a>';
    return;
  }
  status.innerHTML = '<h2>Is this your property?</h2><p>Choose the matching address to see its county assessment.</p><div class="matches"></div>' + (data.hasMore ? '<p>More matches are available. Add the street direction, street type, or unit to narrow your search.</p>' : '');
  const matches=status.querySelector('.matches');
  data.properties.forEach(property => {
    const button=document.createElement('button');button.type='button';button.className='match';
    const label=document.createElement('strong');label.textContent=property.address || 'Parcel '+property.parcel;
    const sub=document.createElement('span');sub.textContent=[property.city,property.state,property.zip].filter(Boolean).join(' ')+' · Parcel '+property.parcel;
    button.append(label,sub);button.addEventListener('click',()=>showCountyProperty(property));matches.append(button);
  });
}
const currency = value => value === null || value === undefined ? 'Unavailable' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
function showCountyProperty(property) {
  detailsRequest?.abort();
  status.hidden=true;results.hidden=false;
  const p=property;
  const value = text => escapeHTML(text ?? 'Not provided');
  const field = (label, text) => `<div><dt>${label}</dt><dd>${value(text)}</dd></div>`;
  const sourceLink = '<a class="county-link" href="https://cp.spokanecounty.gov/scout/SCOUTDashboard/" target="_blank" rel="noopener noreferrer">Open the full record on SCOUT &gt;</a>';
  const missingHistory = '<p>This parcel feed provides a snapshot, not historical records. We haven’t retrieved this history for your property.</p>'+sourceLink+`<p>Search parcel <strong>${value(p.parcel)}</strong> on SCOUT for more information.</p>`;
  const retrieved=new Date(p.source.fetchedAt).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  results.innerHTML = `<div class="result-top"><div><span class="sample-badge county-badge">SPOKANE COUNTY RECORD</span><h2 id="result-title">${value(p.address || 'Parcel '+p.parcel)}</h2><p>${value([p.city,p.state,p.zip].filter(Boolean).join(' '))} · Parcel ${value(p.parcel)}</p></div><button class="text-button" id="back-search">Search another address ^</button></div>
  <div class="county-photo-placeholder">${house}<h3>Your property, in focus.</h3><p>Checking the full county record for property photos…</p></div>
  <div class="value-cards"><article class="value-card"><h3>Spokane County Assessor</h3><p class="price">${currency(p.assessedValue)}</p><small>County assessed value${p.assessmentYear ? ' · Assessment year '+value(p.assessmentYear) : ' · Assessment year not provided'}${p.taxYear ? '<br>Tax year '+value(p.taxYear) : ''}</small></article><article class="value-card pending"><h3>Zillow</h3><p class="pending-label">Not connected</p><small>A Zillow estimate hasn’t been retrieved.</small></article><article class="value-card pending"><h3>realtor.com</h3><p class="pending-label">Not connected</p><small>A Realtor.com estimate hasn’t been retrieved.</small></article></div>
  <p class="data-note">Source: <a class="county-link" href="https://gisdatacatalog-spokanecounty.opendata.arcgis.com/datasets/228db1be1d6940a3b5e3f2104e470134_0" target="_blank" rel="noopener noreferrer">Spokane County public parcel data</a>. Retrieved ${value(retrieved)}. Retrieval time is not the assessment date or a guarantee of freshness. County values are for property assessment and may differ from today’s sale price. Verify details with the county.</p>
  ${detail('Property Details','<dl class="property-grid">'+field('Parcel number',p.parcel)+field('Property use',p.propertyUse)+field('County land-use code',p.propertyUseCode)+field('Lot size',p.acreage === null ? null : p.acreage+' acres')+field('Land value',p.landValue === null ? null : currency(p.landValue))+field('Taxable value',p.taxableValue === null ? null : currency(p.taxableValue))+'</dl><p>Year built, bedrooms, bathrooms, and living area are not included in this parcel feed.</p>')}
  ${detail('Home Value Chart','<p>A value trend needs multiple assessment dates. This source provides a single snapshot, so there isn’t enough data to plot a history yet.</p>')}
  ${detail('Price History',missingHistory)}
  ${detail('Tax History',missingHistory+'<p>Taxable value is not the annual tax bill.</p>')}
  ${detail('Neighborhood and Schools','<p>Neighborhood and school assignments are not included in this feed. Verify attendance boundaries and enrollment with the school district.</p>'+sourceLink)}
  <div class="record-footer">${sourceLink}<p>Enter parcel ${value(p.parcel)} in the county search.</p></div>`;
  document.querySelector('#back-search').addEventListener('click',()=>{clearSearch();address.focus();form.scrollIntoView({behavior:'smooth',block:'center'});});
  loadCountyDetails(p);
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
async function loadCountyDetails(property) {
  const request=new AbortController();detailsRequest=request;
  const banner=document.createElement('p');banner.className='enrichment-note';banner.setAttribute('role','status');banner.textContent='Loading history, building features, and school boundaries from county records…';
  results.querySelector('.value-cards').after(banner);
  const timeout=setTimeout(()=>request.abort('timeout'),22000);
  try{
    const response=await fetch('/api/county-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parcel:property.parcel}),signal:request.signal});
    const data=await response.json();
    if(detailsRequest!==request)return;
    if(!response.ok)throw new Error(data.error?.message||'Full county details are unavailable.');
    if(data.parcel!==property.parcel)throw new Error('County record did not match the selected parcel.');
    renderCountyDetails(data);
    renderCountyPhotos(data.photos || []);
    const asOf=data.source?.dataAsOf;
    banner.textContent=(data.source?'SCOUT details loaded'+(asOf?' · County data as of '+asOf:'')+'. ':'')+(data.warnings?.join(' ')||'');
    if(!banner.textContent)banner.textContent='County boundary information loaded.';
  }catch(error){if(detailsRequest!==request)return;const photoNote=results.querySelector('.county-photo-placeholder p');if(photoNote)photoNote.textContent='The county photo lookup is unavailable right now.';banner.textContent=request.signal.aborted?'Full county details took too long to load. Your basic record is still available.':error.message;}
  finally{clearTimeout(timeout);if(detailsRequest===request)detailsRequest=null;}
}
function renderCountyPhotos(records){
  const placeholder=results.querySelector('.county-photo-placeholder');
  if(!placeholder)return;
  const photos=records.filter(photo=>typeof photo.src==='string'&&/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(photo.src)).slice(0,8);
  if(!photos.length){placeholder.querySelector('p').textContent='No displayable photo was found in this county record.';return;}
  const gallery=document.createElement('figure');gallery.className='gallery county-gallery';gallery.tabIndex=0;gallery.setAttribute('aria-label','County property images');
  const image=document.createElement('img');image.decoding='async';
  const caption=document.createElement('figcaption');caption.setAttribute('aria-live','polite');
  const prev=document.createElement('button');prev.type='button';prev.className='prev';prev.setAttribute('aria-label','Previous property image');prev.textContent='<';
  const next=document.createElement('button');next.type='button';next.className='next';next.setAttribute('aria-label','Next property image');next.textContent='>';
  let index=0;
  function show(){const photo=photos[index];image.alt='County assessor record image '+(index+1);image.src=photo.src;caption.textContent='Source: Spokane County Assessor · '+(index+1)+' / '+photos.length+' · Photo date not provided';prev.hidden=next.hidden=photos.length<2;}
  function move(delta){index=(index+delta+photos.length)%photos.length;show();}
  prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
  gallery.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
  image.addEventListener('error',()=>{photos.splice(index,1);if(!photos.length){placeholder.querySelector('p').textContent='The county image could not be displayed.';gallery.replaceWith(placeholder);return;}index%=photos.length;show();});
  gallery.append(image,caption,prev,next);placeholder.replaceWith(gallery);show();
}
function renderCountyDetails(data){
  const panels=[...results.querySelectorAll('details .detail-content')];
  const e=escapeHTML;
  const money=value=>value===null||value===undefined?'Not provided':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
  const number=value=>value===null||value===undefined?'—':new Intl.NumberFormat('en-US').format(value);
  const table=(headers,rows)=>'<div class="data-table-wrap"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+e(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  const footer=data.source?'<p class="section-source"><a class="county-link" href="'+e(data.source.url)+'" target="_blank" rel="noopener noreferrer">Source: county SCOUT record &gt;</a>'+(data.source.dataAsOf?' · Data as of '+e(data.source.dataAsOf):'')+'</p>':'';
  const structures=data.structures||[];
  if(structures.length){
    panels[0].insertAdjacentHTML('beforeend','<h3 class="detail-subheading">Buildings and features</h3>'+table(['Structure','Year built','Gross living area','Bedrooms*','Full / half baths*'],structures.map(p=>[p.description,p.yearBuilt||'—',p.livingArea===null?'Not provided':number(p.livingArea)+' sq ft',number(p.bedrooms),number(p.fullBaths)+' / '+number(p.halfBaths)]))+(structures.some(p=>p.houseType||p.heat||p.cooling||p.roof)?table(['Structure','County house type','Heating','Cooling','Roof'],structures.map(p=>[p.description,p.houseType||'Not provided',p.heat||'Not provided',p.cooling||'Not provided',p.roof||'Not provided'])):'')+'<p>* County room counts reflect above-grade rooms only. Gross living area is shown as reported; basement areas are not added automatically.</p>'+footer);
    const missing=[...panels[0].querySelectorAll('p')].find(p=>p.textContent.startsWith('Year built, bedrooms'));missing?.remove();
  }
  if(data.propertyType){const type=panels[0].querySelector('dl');type.insertAdjacentHTML('beforeend','<div><dt>County property classification</dt><dd>'+e(data.propertyType)+'</dd></div>');}
  const history=data.assessments||[];
  if(history.length){
    const points=[...history].filter(r=>r.assessedValue!==null).sort((a,b)=>a.taxYear-b.taxYear);
    let chart='';
    if(points.length>=2){const lo=Math.min(...points.map(p=>p.assessedValue));const hi=Math.max(...points.map(p=>p.assessedValue));const range=hi-lo||Math.max(hi*.1,1);const x=p=>55+(p.taxYear-points[0].taxYear)/(points.at(-1).taxYear-points[0].taxYear||1)*680;const y=p=>175-(p.assessedValue-lo)/range*135;chart='<svg class="chart county-chart" role="img" aria-label="County assessed values by tax year; exact values are in the following table" viewBox="0 0 800 235"><path d="M55 25V190H750" fill="none" stroke="#d9dfd1"/><polyline points="'+points.map(p=>x(p)+','+y(p)).join(' ')+'" fill="none" stroke="#58764e" stroke-width="3"/>'+points.map(p=>'<circle cx="'+x(p)+'" cy="'+y(p)+'" r="4" fill="#58764e"/><text x="'+x(p)+'" y="215" text-anchor="middle" fill="#6b7860" font-size="12">'+e(p.taxYear)+'</text>').join('')+'</svg>';}
    panels[1].innerHTML='<p>County assessed values by <strong>tax year</strong>, including future tax years already published by the county. These are assessments, not Zillow or Realtor.com estimates.</p>'+chart+table(['Tax year','Assessed value','Land','Structures'],history.map(p=>[p.taxYear,currency(p.assessedValue),currency(p.landValue),currency(p.structureValue)]))+footer;
  }else if(data.sections?.assessments){panels[1].innerHTML='<p>The county returned no assessment history for this parcel.</p>'+footer;}
  const sales=data.sales||[];
  if(sales.length){panels[2].innerHTML='<p>Recorded county sales and transfers. This is not listing or asking-price history.</p>'+table(['Recorded date','Recorded price','Instrument / event'],sales.map(p=>[p.date,p.price===0?'No price reported ($0 recorded)':money(p.price),p.instrument||'Not provided']))+'<p>A zero-dollar record may be a transfer rather than a market sale.</p>'+footer;}
  else if(data.sections?.sales){panels[2].innerHTML='<p>No recorded sales were returned for this parcel.</p>'+footer;}
  const taxes=data.taxes||[];
  if(taxes.length){panels[3].innerHTML=table(['Tax year','A/V property tax','Total charges','Remaining charges'],taxes.map(p=>[p.taxYear,money(p.propertyTax),money(p.totalCharges),money(p.remainingCharges)]))+'<p>Total charges may include assessments, interest, or fees. Remaining charges are a snapshot from the county and may have changed. Verify payment status with the Treasurer.</p>'+footer;}
  else if(data.sections?.taxes){panels[3].innerHTML='<p>No annual tax-charge history was returned for this parcel.</p>'+footer;}
  const neighborhood=data.neighborhood;
  const schools=data.schools;
  if(neighborhood||schools){let content='';if(neighborhood){content+='<h3 class="detail-subheading">County assessment neighborhood</h3><p>'+e(neighborhood.description||neighborhood.name||'Not provided')+(neighborhood.code?' · Code '+e(neighborhood.code):'')+'</p><p>This is the county’s assessment neighborhood, which may differ from a commonly used neighborhood name.</p>';}
    if(schools){const districts=[...new Set((schools.districts||[]).map(d=>d.name))];content+='<h3 class="detail-subheading">School district boundaries</h3><p>'+(districts.length?e(districts.join(' · ')):schools.districtsAvailable?'No district boundary matches were returned.':'District boundaries are currently unavailable.')+'</p>';const entries=schools.schools||[];content+='<h3 class="detail-subheading">School boundary matches</h3>'+(entries.length?table(['School / boundary','County type'],entries.map(s=>[s.name,s.type||'Not provided'])):'<p>'+(schools.schoolsAvailable?'No school boundary matches were returned.':'Individual school boundaries are currently unavailable.')+'</p>')+'<p>Matches show county boundaries that overlap the parcel. Overlapping boundaries can produce multiple results; they do not guarantee attendance or enrollment. Confirm current assignments with the district.</p><p class="section-source"><a class="county-link" href="https://gismo.spokanecounty.org/arcgis/rest/services/OpenData/Boundary/MapServer" target="_blank" rel="noopener noreferrer">Source: county school boundary GIS &gt;</a></p>';}
    panels[4].innerHTML=content+footer;
  }
  if(data.source?.url){results.querySelectorAll('a[href="https://cp.spokanecounty.gov/scout/SCOUTDashboard/"]').forEach(link=>{link.href=data.source.url;});}
}
address.addEventListener('input', () => { address.setCustomValidity(''); clearSearch(); });
function detail(title, body, open = false) { return `<details ${open ? 'open' : ''}><summary>${title}</summary><div class="detail-content">${body}</div></details>`; }
const dialog = document.querySelector('#legal-dialog');
const legal = {
 privacy: {title:'Privacy policy',body:'<p>When you submit a county search, your address or parcel number is sent to our server and queried against Spokane County’s public parcel service. We do not intentionally retain search queries or store them in your browser. We do not use analytics or advertising cookies. Hosting and county providers may process requests under their own policies.</p><p>The hosting provider may process standard request information, such as IP address and browser details, to deliver and secure this website.</p><p>Zillow and Realtor.com are not connected and do not receive searches through this site. This policy will be updated as additional providers are connected.</p>'},
 terms: {title:'Terms of service',body:'<p>Home Values provides access to Spokane County public parcel records. County information may be incomplete or outdated; verify it directly with the county. Full details are extracted from the selected parcel’s SCOUT summary. School results use county boundary overlaps and do not guarantee enrollment. County assessments are for tax purposes and are not appraisals or current sale-price predictions. County record images are displayed when available and may be outdated. Zillow and Realtor.com estimates and listing photos are not connected.</p><p>Home Values is independent and is not affiliated with or endorsed by Zillow, Realtor.com, or Spokane County. Their names identify the intended comparison sources. All trademarks belong to their respective owners.</p><p>When live data becomes available, availability and accuracy will vary by source. Verify property records, taxes, school assignments, and valuations directly with the relevant provider or qualified professional.</p>'}
};
document.querySelectorAll('[data-legal]').forEach(button => button.addEventListener('click', () => { const page = legal[button.dataset.legal]; document.querySelector('#legal-title').textContent = page.title; document.querySelector('#legal-content').innerHTML = page.body; dialog.showModal(); }));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if(e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
