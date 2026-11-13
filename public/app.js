const form = document.querySelector('#search-form');
const address = document.querySelector('#address');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const compare = form.querySelector('button');
let searchTimer;
const house = '<div class="loading-house"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m5 19 15-13 15 13M10 16v18h20V16M17 34V23h6v11"/></svg></div>';
function clearSearch() { clearTimeout(searchTimer); results.hidden = true; status.hidden = true; compare.disabled = false; compare.textContent = 'Compare home values >'; }
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!address.value.trim()) { address.setCustomValidity('Please enter your property address.'); address.reportValidity(); return; }
  clearSearch();
  status.hidden = false;
  status.innerHTML = house + '<h2>Looking closer at your home</h2><p>Preparing your comparison…</p>';
  compare.disabled = true;
  compare.textContent = 'Preparing comparison…';
  status.scrollIntoView({behavior:'smooth', block:'center'});
  searchTimer = setTimeout(() => {
    compare.disabled = false;
    compare.textContent = 'Compare home values >';
    status.innerHTML = '<h2>Live comparisons are coming soon</h2><p>Property data isn’t connected yet, so we can’t retrieve estimates or photos for this address.</p><p>Your address hasn’t been sent to any property provider.</p><button class="text-button" id="status-sample" style="margin:auto">Explore a sample comparison ></button>';
    document.querySelector('#status-sample').addEventListener('click', showSample);
  }, 900);
});
address.addEventListener('input', () => { address.setCustomValidity(''); clearSearch(); });
function detail(title, body, open = false) { return `<details ${open ? 'open' : ''}><summary>${title}</summary><div class="detail-content">${body}</div></details>`; }
function showSample() {
  clearSearch();
  results.hidden = false;
  results.innerHTML = `<div class="result-top"><div><span class="sample-badge">SAMPLE COMPARISON · FICTIONAL PROPERTY</span><h2>A Spokane home, at a glance.</h2><p>Illustrative property · Spokane, WA</p></div><button class="text-button" id="back-search">Search another address ^</button></div>
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
 privacy: {title:'Privacy policy',body:'<p>This interface preview does not send your address to a property data provider, store it in browser storage, or use analytics or advertising cookies. The address you enter stays in the current page and is cleared when you reload.</p><p>The hosting provider may process standard request information, such as IP address and browser details, to deliver and secure this website.</p><p>Before live property services are introduced, this policy will be updated to identify the providers, data uses, retention practices, and a privacy contact.</p>'},
 terms: {title:'Terms of service',body:'<p>Home Values is currently an interface preview. Sample comparisons contain fictional figures and are not property valuations, appraisals, offers, or financial advice. Live estimates and property photos are not available yet.</p><p>Home Values is independent and is not affiliated with or endorsed by Zillow, Realtor.com, or Spokane County. Their names identify the intended comparison sources. All trademarks belong to their respective owners.</p><p>When live data becomes available, availability and accuracy will vary by source. Verify property records, taxes, school assignments, and valuations directly with the relevant provider or qualified professional.</p>'}
};
document.querySelectorAll('[data-legal]').forEach(button => button.addEventListener('click', () => { const page = legal[button.dataset.legal]; document.querySelector('#legal-title').textContent = page.title; document.querySelector('#legal-content').innerHTML = page.body; dialog.showModal(); }));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if(e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
