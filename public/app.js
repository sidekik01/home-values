const form = document.querySelector('#search-form');
const address = document.querySelector('#address');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const compare = form.querySelector('button');
let countyRequest;
const house = '<div class="loading-house"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m5 19 15-13 15 13M10 16v18h20V16M17 34V23h6v11"/></svg></div>';
function clearSearch() { countyRequest?.abort(); countyRequest = null; results.hidden = true; status.hidden = true; compare.disabled = false; compare.textContent = 'Compare home values >'; }
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
  status.hidden=true;results.hidden=false;
  const p=property;
  const value = text => escapeHTML(text ?? 'Not provided');
  const field = (label, text) => `<div><dt>${label}</dt><dd>${value(text)}</dd></div>`;
  const sourceLink = '<a class="county-link" href="https://cp.spokanecounty.gov/scout/SCOUTDashboard/" target="_blank" rel="noopener noreferrer">Open the full record on SCOUT &gt;</a>';
  const missingHistory = '<p>This parcel feed provides a snapshot, not historical records. We haven’t retrieved this history for your property.</p>'+sourceLink+`<p>Search parcel <strong>${value(p.parcel)}</strong> on SCOUT for more information.</p>`;
  const retrieved=new Date(p.source.fetchedAt).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  results.innerHTML = `<div class="result-top"><div><span class="sample-badge county-badge">SPOKANE COUNTY RECORD</span><h2 id="result-title">${value(p.address || 'Parcel '+p.parcel)}</h2><p>${value([p.city,p.state,p.zip].filter(Boolean).join(' '))} · Parcel ${value(p.parcel)}</p></div><button class="text-button" id="back-search">Search another address ^</button></div>
  <div class="county-photo-placeholder">${house}<h3>Your property, in focus.</h3><p>Property photos aren’t available in this county feed.</p></div>
  <div class="value-cards"><article class="value-card"><h3>Spokane County Assessor</h3><p class="price">${currency(p.assessedValue)}</p><small>County assessed value${p.assessmentYear ? ' · Assessment year '+value(p.assessmentYear) : ' · Assessment year not provided'}${p.taxYear ? '<br>Tax year '+value(p.taxYear) : ''}</small></article><article class="value-card pending"><h3>Zillow</h3><p class="pending-label">Not connected</p><small>A Zillow estimate hasn’t been retrieved.</small></article><article class="value-card pending"><h3>realtor.com</h3><p class="pending-label">Not connected</p><small>A Realtor.com estimate hasn’t been retrieved.</small></article></div>
  <p class="data-note">Source: <a class="county-link" href="https://gisdatacatalog-spokanecounty.opendata.arcgis.com/datasets/228db1be1d6940a3b5e3f2104e470134_0" target="_blank" rel="noopener noreferrer">Spokane County public parcel data</a>. Retrieved ${value(retrieved)}. Retrieval time is not the assessment date or a guarantee of freshness. County values are for property assessment and may differ from today’s sale price. Verify details with the county.</p>
  ${detail('Property Details','<dl class="property-grid">'+field('Parcel number',p.parcel)+field('Property use',p.propertyUse)+field('County land-use code',p.propertyUseCode)+field('Lot size',p.acreage === null ? null : p.acreage+' acres')+field('Land value',p.landValue === null ? null : currency(p.landValue))+field('Taxable value',p.taxableValue === null ? null : currency(p.taxableValue))+'</dl><p>Year built, bedrooms, bathrooms, and living area are not included in this parcel feed.</p>',true)}
  ${detail('Home Value Chart','<p>A value trend needs multiple assessment dates. This source provides a single snapshot, so there isn’t enough data to plot a history yet.</p>')}
  ${detail('Price History',missingHistory)}
  ${detail('Tax History',missingHistory+'<p>Taxable value is not the annual tax bill.</p>')}
  ${detail('Neighborhood and Schools','<p>Neighborhood and school assignments are not included in this feed. Verify attendance boundaries and enrollment with the school district.</p>'+sourceLink)}
  <div class="record-footer">${sourceLink}<p>Enter parcel ${value(p.parcel)} in the county search.</p></div>`;
  document.querySelector('#back-search').addEventListener('click',()=>{clearSearch();address.focus();form.scrollIntoView({behavior:'smooth',block:'center'});});
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
address.addEventListener('input', () => { address.setCustomValidity(''); clearSearch(); });
function detail(title, body, open = false) { return `<details ${open ? 'open' : ''}><summary>${title}</summary><div class="detail-content">${body}</div></details>`; }
function showSample() {
  clearSearch();
  results.hidden = false;
  results.innerHTML = `<div class="result-top"><div><span class="sample-badge">SAMPLE COMPARISON · FICTIONAL PROPERTY</span><h2 id="result-title">A Spokane home, at a glance.</h2><p>Illustrative property · Spokane, WA</p></div><button class="text-button" id="back-search">Search another address ^</button></div>
  <figure class="gallery"><img id="property-photo" src="sample-home.svg" alt="Illustration of a sample home, not an actual property"><figcaption id="photo-caption">Sample home illustration · 1 / 2</figcaption><button class="prev" aria-label="Previous property image">&lt;</button><button class="next" aria-label="Next property image">&gt;</button></figure>
  <div class="value-cards"><article class="value-card"><h3>Spokane County Assessor</h3><p class="price">$412,000</p><small>Sample assessed value · For tax purposes</small></article><article class="value-card"><h3>Zillow</h3><p class="price">$438,500</p><small>Illustrative estimate · Not a live Zestimate®</small></article><article class="value-card"><h3>realtor.com</h3><p class="price">$429,000</p><small>Illustrative estimate · Not live provider data</small></article></div>
  <p class="data-note">All figures, features, and history below are fictional examples for this interface preview. The photo carousel uses an illustration and the supplied design photo, not listing photos. Assessed values and market estimates serve different purposes and may differ. Estimates are not appraisals.</p>
  ${detail('Property Details', '<dl class="property-grid"><div><dt>Property type</dt><dd>Single family</dd></div><div><dt>Year built</dt><dd>1998</dd></div><div><dt>Living area</dt><dd>2,140 sq ft</dd></div><div><dt>Bedrooms</dt><dd>3</dd></div><div><dt>Bathrooms</dt><dd>2</dd></div><div><dt>Lot size</dt><dd>0.21 acres</dd></div></dl>', true)}
  ${detail('Home Value Chart', '<p>Illustrative annual values · 2021–2025</p><div class="chart-key"><span>County assessment</span><span>Zillow example</span><span>Realtor.com example</span></div><svg class="chart" role="img" aria-label="Fictional annual home values rise between 2021 and 2025. County assessment: $320,000 to $412,000; Zillow example: $340,000 to $438,500; Realtor.com example: $330,000 to $429,000." viewBox="0 0 800 240"><g stroke="#e2e4dc"><path d="M55 30H780M55 90H780M55 150H780M55 210H780"/></g><g fill="#7c8675" font-size="12"><text y="34">$450k</text><text y="94">$400k</text><text y="154">$350k</text><text y="214">$300k</text></g><path d="M60 186 240 144 420 132 600 96 780 76" stroke="#78926e" stroke-width="3" fill="none"/><path d="M60 162 240 114 420 102 600 66 780 44" stroke="#a48b51" stroke-width="3" fill="none"/><path d="M60 174 240 126 420 114 600 84 780 55" stroke="#597f9d" stroke-width="3" fill="none"/></svg><div class="chart-labels"><span>2021</span><span>2022</span><span>2023</span><span>2024</span><span>2025</span></div>')}
  ${detail('Price History', '<table><caption class="sr-only">Fictional price history</caption><thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Price</th></tr></thead><tbody><tr><td>Jun 2021</td><td>Sold</td><td>$340,000</td></tr><tr><td>May 2021</td><td>Listed</td><td>$349,000</td></tr><tr><td>Aug 2014</td><td>Sold</td><td>$218,000</td></tr></tbody></table>')}
  ${detail('Tax History', '<table><caption class="sr-only">Fictional tax history</caption><thead><tr><th scope="col">Year</th><th scope="col">Assessed value</th><th scope="col">Property tax</th></tr></thead><tbody><tr><td>2025</td><td>$412,000</td><td>$4,326</td></tr><tr><td>2024</td><td>$395,000</td><td>$4,148</td></tr><tr><td>2023</td><td>$365,000</td><td>$3,833</td></tr></tbody></table>')}
  ${detail('Neighborhood and Schools', '<p>Neighborhood boundaries, nearby amenities, school assignments, and district links will appear here when a property data source is connected.</p><p>Always verify attendance boundaries and enrollment eligibility with the school district.</p>')}`;
  document.querySelector('#back-search').addEventListener('click', () => { clearSearch(); address.focus(); form.scrollIntoView({behavior:'smooth',block:'center'}); });
  const photos = [{src:'sample-home.svg', alt:'Illustration of a sample home, not an actual property', caption:'Sample home illustration'},{src:'hero.webp',alt:'Supplied interior design reference photo, not a listing photo',caption:'Interior design reference · Not a listing photo'}];
  let photoIndex = 0;
  function changePhoto(delta) { photoIndex = (photoIndex + delta + photos.length) % photos.length; const photo = photos[photoIndex]; const img = document.querySelector('#property-photo'); img.src = photo.src; img.alt = photo.alt; document.querySelector('#photo-caption').textContent = `${photo.caption} · ${photoIndex + 1} / ${photos.length}`; }
  document.querySelector('.prev').addEventListener('click', () => changePhoto(-1));
  document.querySelector('.next').addEventListener('click', () => changePhoto(1));
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
document.querySelector('#sample-button').addEventListener('click', showSample);
const dialog = document.querySelector('#legal-dialog');
const legal = {
 privacy: {title:'Privacy policy',body:'<p>When you submit a county search, your address or parcel number is sent to our server and queried against Spokane County’s public parcel service. We do not intentionally retain search queries or store them in your browser. We do not use analytics or advertising cookies. Hosting and county providers may process requests under their own policies.</p><p>The hosting provider may process standard request information, such as IP address and browser details, to deliver and secure this website.</p><p>Zillow and Realtor.com are not connected and do not receive searches through this site. Sample comparisons are fictional. This policy will be updated as additional providers are connected.</p>'},
 terms: {title:'Terms of service',body:'<p>Home Values provides access to Spokane County public parcel records. County information may be incomplete or outdated; verify it directly with the county. County assessments are for tax purposes and are not appraisals or current sale-price predictions. Zillow and Realtor.com estimates and property photos are not connected. Sample comparisons contain fictional figures and are not property valuations, offers, or financial advice.</p><p>Home Values is independent and is not affiliated with or endorsed by Zillow, Realtor.com, or Spokane County. Their names identify the intended comparison sources. All trademarks belong to their respective owners.</p><p>When live data becomes available, availability and accuracy will vary by source. Verify property records, taxes, school assignments, and valuations directly with the relevant provider or qualified professional.</p>'}
};
document.querySelectorAll('[data-legal]').forEach(button => button.addEventListener('click', () => { const page = legal[button.dataset.legal]; document.querySelector('#legal-title').textContent = page.title; document.querySelector('#legal-content').innerHTML = page.body; dialog.showModal(); }));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if(e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
