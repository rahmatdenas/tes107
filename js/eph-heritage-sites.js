'use strict';

const CHUNK_SIZE = 35;
var currentRenderIndex = 0;
var currentFilteredRecords = [];
var isFilterEventAttached = false; 

function potongJadiKelompok(array, ukuran) {
  let hasilPotongan = [];
  for (let i = 0; i < array.length; i += ukuran) {
    hasilPotongan.push(array.slice(i, i + ukuran));
  }
  return hasilPotongan;
}

function formatWikidataDate(dateString, precision) {
  if (!dateString) return null;  
  let cleanStr = dateString.replace(/^[+-]/, '');   
  let yearStr  = cleanStr.substring(0, 4);
  let monthStr = cleanStr.substring(5, 7);
  let dayStr   = cleanStr.substring(8, 10);
  let yearNum  = parseInt(yearStr);
  const bulanIndo = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  let prec = parseInt(precision) || 9; 
  
  if (prec === 11) return `${parseInt(dayStr)} ${bulanIndo[parseInt(monthStr)]} ${yearStr}`;
  if (prec === 10) return `${bulanIndo[parseInt(monthStr)]} ${yearStr}`;
  if (prec === 9)  return yearStr;
  if (prec === 8)  return `${yearStr}-an`;
  if (prec === 7) {
    let century = Math.ceil(yearNum / 100);
    return `abad ke-${century}`;
  } 
  return yearStr;
}

function loadPrimaryData() {
  let tiketPencarianIni = currentSearchToken;
  doPreProcessing();

  populateProvinceTypesData() 
    .then(() => {
      if (currentSearchToken !== tiketPencarianIni) throw 'ABORTED';
      if (globalFetchController && globalFetchController.signal.aborted && !window.hentikanPencarian) throw 'ABORTED';
      
      return populateCoordinatesData().then(() => {
         if (currentSearchToken !== tiketPencarianIni) throw 'ABORTED';
         if (globalFetchController && globalFetchController.signal.aborted && !window.hentikanPencarian) throw 'ABORTED';
         populateMapAndIndex();
      });
    })
    .then(() => {
      if (currentSearchToken !== tiketPencarianIni) throw 'ABORTED';
      if (globalFetchController && globalFetchController.signal.aborted && !window.hentikanPencarian) throw 'ABORTED';
      
      enableApp(); 
      applyIntersectionFilter(); 
      processHashChange();

      let btnAll = document.getElementById('btn-all');
      if (btnAll) {
        btnAll.classList.remove('disabled'); 
        btnAll.classList.add('active');      
      }

      populateImageAndWikipediaData();
    })
    .catch(error => {
       if (error === 'ABORTED' || (error && error.name === 'AbortError')) return; 

       isFetching = false;
       PrimaryDataIsLoaded = false;

       let indexList = document.getElementById('index-list');
       if (indexList) {         
         indexList.innerHTML = `
           <div style="padding: 40px 20px; text-align: center; line-height: 1.6;">
             <h3 style="margin-bottom: 10px; margin-top:0; color: #cc0000;">Gagal Menarik Data</h3>
             <p style="color: #666; font-size:14px; margin-bottom: 25px;">Pastikan internet stabil atau tutup dan coba lagi nanti.</p>
             <a href="#" onclick="window.location.href = window.location.pathname; return false;" style="background-color: #7b0d0c; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">Kembali</a>
           </div>
         `;
       }
       console.error("Data utama gagal dimuat:", error);
    }); 
}

function doPreProcessing() {
  let anchorElem = document.getElementById('wdqs-link');
  if (anchorElem) {
    anchorElem.href = 'https://query.wikidata.org/#' + encodeURIComponent(ABOUT_SPARQL_QUERY);
  }
  processHashChange();
}

function aturTampilanNegara() {
  let provInput = document.getElementById('provinsi-input').value;
  let wadahNegara = document.getElementById('wadah-negara');
  wadahNegara.style.display = (provInput === 'luar_negeri') ? 'block' : 'none';
}

function populateProvinceTypesData() {
  let inputTxt = document.getElementById('jenis-input').value.trim();
  let provDropdown = document.getElementById('provinsi-input');
  let provInput = provDropdown.value;
  let jenisDropdown = document.getElementById('jenis-dropdown');
  let opsiTerpilih = jenisDropdown.options[jenisDropdown.selectedIndex];

  // Mengambil konfigurasi klaster aktif (Data-Driven)
  let kunciAktif = currentClusterKey || 'custom';
  let config = KonfigurasiKlaster[kunciAktif] || KonfigurasiKlaster['custom'];
  
  currentNamaKlaster = (jenisDropdown.value === 'custom') ? 'Objek' : opsiTerpilih.text;
  let propLokasi = config.infoDasar.pidLokasi || 'P131';
  let propTahun = config.infoDasar.pidTahun || 'P571';
  
  if (provInput === 'luar_negeri') {
    let negaraDropdown = document.getElementById('negara-input');
    currentNamaWilayah = negaraDropdown.options[negaraDropdown.selectedIndex].text;
  } else {
    currentNamaWilayah = provDropdown.options[provDropdown.selectedIndex].text;
  }
  
  let brandingDesc = document.getElementById('branding-desc');
  if (brandingDesc) brandingDesc.textContent = `${currentNamaKlaster} di ${currentNamaWilayah}`;

  let indexList = document.getElementById('index-list');
  if (indexList) {
    indexList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; line-height: 1.6;">
        <h3 id="loading-text" style="margin-bottom: 10px; margin-top:0; color: #333;">
          Sedang Menarik Data<br/>${currentNamaKlaster} di ${currentNamaWilayah}
        </h3>
        <p style="color: #666; font-size:14px; margin-bottom: 25px;">Harap menunggu sebentar...</p>
        <div class="loader" style="margin: 0 auto; width: 40px; height: 40px; border-width: 4px;"></div>
      <div id="wadah-tombol-berhenti" style="margin-top: 42px;"></div>
      </div>
    `;
  }
  
  function eksekusiKueriKeWikidata(kueriFinal) {
    console.log("Kueri yang dikirim:", kueriFinal);
    return queryWdqsPaginated(
      kueriFinal,
      function(result) {
        let qid = result.SQ.value;
        if (!(qid in Records)) Records[qid] = new SimpleRecord(); 
        
        let record = Records[qid];
        record.id = qid;
        record.title = ('sLabel' in result && result.sLabel.value) ? result.sLabel.value : '[ERROR: No title]';

        let provQid = result.PQ ? result.PQ.value : 'Q_UNKNOWN';
        let provLabel = result.pLabel ? result.pLabel.value : 'Wilayah Lainnya/Tidak Spesifik';

        if (!(provQid in ProvinceIndex)) {
          ProvinceIndex[provQid] = new ProvinceIndexEntry();
          ProvinceIndex[provQid].name = provLabel; 
        }
        if (!(provQid in record.designations)) record.designations[provQid] = provLabel; 
        
        record.areaTags.add(provQid);
        if ('lLabel' in result && result.lLabel.value) record.lokasiSpesifik = result.lLabel.value;
        
        if (!record.tahunBerdiri && result.tM && result.tM.value) {
          let precision = result.tP ? result.tP.value : 9;
          record.tahunBerdiri = formatWikidataDate(result.tM.value, precision);        
          record.rawTahunBerdiri = result.tM.value.replace(/^[+-]/, '');
        }
      },
      function() {
        populateProvinceIndex(); 
        Object.values(Records).forEach(record => { record.indexTitle = record.title });
      },
      5000 
    );
  }

  let baseQuery = KUMPULAN_KUERI_0['universal'];
  if (inputTxt.toLowerCase() === 'apapun') {
    baseQuery = KUMPULAN_KUERI_0['apapun'];
    currentNamaKlaster = 'Objek'; 
  }

  let wilayahClause1 = '';
  let unionEkstra = ''; 
  let hierarkiLokasi = '?l wdt:P131* ?p .'; 
  let kurungBuka = '';
  let kurungTutup = '';
  let filterNasional = '?s wdt:P17 wd:Q252 .';

  if (provInput === 'luar_negeri') {
    let negaraDropdown = document.getElementById('negara-input');
    baseQuery = KUMPULAN_KUERI_0['luar_negeri'];
    let dynamicQuery = baseQuery;

    if (inputTxt.toLowerCase() === 'apapun') {
      dynamicQuery = dynamicQuery.replace(/VALUES \?j \{ <PLACEHOLDER_JENIS> \}/g, '');
    } else {
      dynamicQuery = dynamicQuery.replace(/<PLACEHOLDER_JENIS>/g, inputTxt);
    }
    
    dynamicQuery = dynamicQuery
      .replace(/<PLACEHOLDER_NEGARA>/g, negaraDropdown.value)
      .replace(/<PLACEHOLDER_PROP_LOKASI>/g, propLokasi)
      .replace(/<PLACEHOLDER_PROP_TAHUN>/g, propTahun);
      
    return eksekusiKueriKeWikidata(dynamicQuery); 
  }
  
  if (provInput === 'all') {
    wilayahClause1 = '?p wdt:P31 wd:Q5098 .';
    if (kunciAktif !== 'custom' && inputTxt.toLowerCase() !== 'apapun') {
      baseQuery = KUMPULAN_KUERI_0['khusus_negara_all'];
    }
  } else {
    wilayahClause1 = `?p wdt:P131 ${provInput}.`;
    let wilayahClause2 = `BIND(${provInput} AS ?p) BIND(${provInput} AS ?l)`; 
    kurungBuka = '{';
    kurungTutup = '}';
    
    unionEkstra = `
    UNION {
      ${wilayahClause2}
      ?s wdt:P31 ?j ;
         wdt:${propLokasi} ?l .
    }`;
    
    if (inputTxt.toLowerCase() === 'apapun') {
       unionEkstra = `
       UNION {
         ${wilayahClause2}
         ?s wdt:P17 wd:Q252 ; wdt:P625 [] ; wdt:P18 [] ; wdt:P131 ?l .
       }`;
    }
  }
  
  let dynamicQuery = baseQuery
    .replace(/<PLACEHOLDER_FILTER_NASIONAL>/g, filterNasional)
    .replace(/<PLACEHOLDER_KURUNG_BUKA>/g, kurungBuka)  
    .replace(/<PLACEHOLDER_KURUNG_TUTUP>/g, kurungTutup)  
    .replace(/<PLACEHOLDER_WILAYAH_1>/g, wilayahClause1)
    .replace(/<PLACEHOLDER_PROP_LOKASI>/g, propLokasi)
    .replace(/<PLACEHOLDER_PROP_TAHUN>/g, propTahun)
    .replace(/<PLACEHOLDER_HIERARKI_LOKASI>/g, hierarkiLokasi)
    .replace(/<PLACEHOLDER_UNION_EKSTRA>/g, unionEkstra) 
    .replace(/<PLACEHOLDER_JENIS>/g, inputTxt);

  return eksekusiKueriKeWikidata(dynamicQuery);
}

async function populateCoordinatesData() {
  let daftarQid = Object.keys(Records).map(id => 'wd:' + id);
  if (daftarQid.length === 0) return;

  let config = KonfigurasiKlaster[currentClusterKey || 'custom'] || KonfigurasiKlaster['custom'];
  let propLokasi = config.infoDasar.pidLokasi || 'P131';
  let templateKueri = KUMPULAN_KUERI_1['universal'];

  let klausaKoordinat = (propLokasi === 'P131') 
    ? `?site p:P625 ?coordStatement .` 
    : `?site wdt:${propLokasi} ?p131Lokasi . FILTER(?p131Lokasi != wd:Q252) ?p131Lokasi p:P625 ?coordStatement .`;

  let kelompokCicilan = potongJadiKelompok(daftarQid, 1000);
  let batchSize = 4; 
  let tiketPencarianIni = currentSearchToken;
  
  for (let i = 0; i < kelompokCicilan.length; i += batchSize) {
    if (currentSearchToken !== tiketPencarianIni) break;
    let potonganBatch = kelompokCicilan.slice(i, i + batchSize);
    
    let progressText = document.querySelector('#index-list p');
    if (progressText) {
      let persentase = Math.round((i / kelompokCicilan.length) * 100);
      progressText.innerHTML = `Menyusun koordinat... (${persentase}%)`;
    }

    let daftarJanji = potonganBatch.map(cicilan => {
      let kueriFinal = templateKueri
        .replace(/<PLACEHOLDER_QIDS>/g, cicilan.join(' '))
        .replace(/<PLACEHOLDER_KLAUSA_KOORDINAT>/g, klausaKoordinat);

      return queryWdqsThenProcess(kueriFinal, function(result) {
        let record = Records[result.siteQid.value];
        if (!record) return; 
        let wktBits = result.coord.value.split(/\(|\)| /);
        record.lat = parseFloat(wktBits[2]);
        record.lon = parseFloat(wktBits[1]);
      });
    });

    try {
      await Promise.all(daftarJanji);
    } catch (error) {
      if (error === 'ABORTED') throw error;
    }
  }
  BootstrapDataIsLoaded = true;
}

async function populateImageAndWikipediaData() {
  let daftarQid = Object.values(Records)
    .sort((a, b) => a.indexTitle.localeCompare(b.indexTitle))
    .map(record => 'wd:' + record.id);
  
  if (daftarQid.length === 0) return;

  let kelompokCicilan = potongJadiKelompok(daftarQid, 1000);
  let btnImg = document.getElementById('btn-image') || document.querySelector('[data-filter="image"]');
  let btnArt = document.getElementById('btn-article') || document.querySelector('[data-filter="article"]');
  
  let signal = typeof globalFetchController !== 'undefined' ? globalFetchController.signal : null;

  if (btnImg) btnImg.classList.remove('disabled');
  if (btnArt) btnArt.classList.remove('disabled');

  const tarikSatuKloter = async (cicilan) => {
    let kueriFinal = SPARQL_QUERY_3_TEMPLATE.replace('<PLACEHOLDER_QIDS>', cicilan.join(' '));
    return queryWdqsThenProcess(kueriFinal, function(result) {
      let rawQid = result.siteQid.value;
      let cleanQid = rawQid.includes('entity/') ? rawQid.split('entity/')[1] : rawQid;
      let record = Records[cleanQid];      
      if (!record) return; 

      if ('image' in result) record.imageFilename = extractImageFilename(result.image);
      if ('wikipediaUrlTitle' in result) {
        let rawArt = result.wikipediaUrlTitle.value;
        record.articleTitle = decodeURIComponent(rawArt.substring(rawArt.lastIndexOf('/') + 1));
      }
    }, null, signal);
  };

  try {
    if (daftarQid.length <= 20000) {
      let hasilKloter = await Promise.allSettled(kelompokCicilan.map(c => tarikSatuKloter(c)));
      if (signal && signal.aborted) throw 'ABORTED';
      applyIntersectionFilter(true); 
    } else {
      let batchSize = 3; 
      let chunksCompleted = 0;
      for (let i = 0; i < kelompokCicilan.length; i += batchSize) {
        if (signal && signal.aborted) throw 'ABORTED'; 
        let potonganBatch = kelompokCicilan.slice(i, i + batchSize);
        await Promise.allSettled(potonganBatch.map(c => tarikSatuKloter(c)));

        chunksCompleted += potonganBatch.length;
        let persentase = Math.round((chunksCompleted / kelompokCicilan.length) * 100);
        
        if (btnImg) btnImg.textContent = `Gambar (${persentase}%)`;
        if (btnArt) btnArt.textContent = `Artikel (${persentase}%)`;
        applyIntersectionFilter(true); 
      }
      if (btnImg) btnImg.textContent = 'Memiliki Gambar';
      if (btnArt) btnArt.textContent = 'Memiliki Artikel';
    }
  } catch (error) {
    console.log('Penarikan gambar selesai/dibatalkan.');
  }
}

function populateImportantEventsData(qid) {
  let record = Records[qid];
  let queryStr = getSparqlQuery4(qid);
  record.events = []; 

  const ALLOWED_EVENTS = ['konstruksi', 'dibuka untuk umum', 'upacara pembukaan', 'renovasi', 'pembangunan kembali'];

  return queryWdqsThenProcess(
    queryStr,
    function(result) {
      if ('eventLabel' in result && result.eventLabel.value) {
        let labelKecil = result.eventLabel.value.toLowerCase();
        if (ALLOWED_EVENTS.includes(labelKecil)) {
          let rawDateStr = (result.pointInTime ? result.pointInTime.value : null) || 
                           (result.startTime ? result.startTime.value : null) || 
                           (result.endTime ? result.endTime.value : null);
          let extractYear = rawDateStr ? parseInt(rawDateStr.match(/([+-]?\d{4,})/)[0]) : 9999;

          let eventObj = { label: result.eventLabel.value, time: '', sortYear: extractYear };
          let pt = result.pointInTime ? formatWikidataDate(result.pointInTime.value, result.ptPrecision ? result.ptPrecision.value : 9) : null;
          let st = result.startTime ? formatWikidataDate(result.startTime.value, result.stPrecision ? result.stPrecision.value : 9) : null;
          let et = result.endTime ? formatWikidataDate(result.endTime.value, result.etPrecision ? result.etPrecision.value : 9) : null;

          if (pt) eventObj.time = pt;
          else if (st && et) eventObj.time = `${st}–${et}`;
          else if (st) eventObj.time = `${st} (dimulai)`; 
          else if (et) eventObj.time = `${et} (diselesaikan)`; 

          let isDuplicate = record.events.some(e => e.label === eventObj.label && e.time === eventObj.time);
          if (!isDuplicate) record.events.push(eventObj);
        }
      }
    },
    function() { populateStatusAndCapacityData(qid); }
  ).catch(error => {
    record._gagalOffline = true;
    populateStatusAndCapacityData(qid);
  });
}

function populateStatusAndCapacityData(qid) {
  let record = Records[qid];
  
  // Menggunakan fungsi pembuat kueri dinamis dari JS 2
  let queryStr = typeof buildDynamicSparqlQuery === 'function' ? buildDynamicSparqlQuery(qid) : ''; 

  record.dynamicProps = {};

  return queryWdqsThenProcess(
    queryStr,
    function(result) {
      Object.keys(result).forEach(key => {
        if (key !== 'siteQid' && result[key].value) {
          record.dynamicProps[key] = result[key].value;
        }
      });
    },
    function() { renderDynamicDataInPanel(qid); }
  ).catch(error => {
    record._gagalOffline = true;
    renderDynamicDataInPanel(qid);
  });
}

function renderDynamicDataInPanel(qid) {
  let record = Records[qid];
  if (!record.panelElem) return;
  let container = record.panelElem.querySelector(`#events-container-${qid}`);
  if (!container) return; 

  let html = '';
  let wikiBaseUrl = `https://www.wikidata.org/wiki/${qid}`;

  // Render Sejarah (Events)
  if (record.events && record.events.length > 0) {
    const EVENT_ORDER = { 'konstruksi': 1, 'dibuka untuk umum': 2, 'upacara pembukaan': 3, 'renovasi': 4, 'pembangunan kembali': 5 };
    record.events.sort((a, b) => {
      if (a.sortYear !== b.sortYear) return a.sortYear - b.sortYear;
      return (EVENT_ORDER[a.label.toLowerCase()] || 99) - (EVENT_ORDER[b.label.toLowerCase()] || 99);
    });
    record.events.forEach(ev => {
      html += `<p>${ev.label.charAt(0).toUpperCase() + ev.label.slice(1)}: ${ev.time}</p>`;
    });
  }

  // Render Data Dinamis berdasarkan Konfigurasi Klaster (Data-Driven)
  let config = KonfigurasiKlaster[currentClusterKey || 'custom'] || KonfigurasiKlaster['custom'];
  
  if (record.dynamicProps && Object.keys(record.dynamicProps).length > 0) {
    
    // Khusus Tipe List (Jika ada) - Timpa Header Panel
    if (record.dynamicProps.tipeList) {
      let headerTextElem = record.panelElem.querySelector(`#header-text-${qid}`);
      if (headerTextElem && record.dynamicProps.tipeList.trim() !== '') {
        headerTextElem.textContent = record.dynamicProps.tipeList.split(', ').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
      }
    }

    config.properti.forEach(prop => {
      let rawValue = record.dynamicProps[prop.id];
      if (!rawValue || prop.id === 'tipeList') return; // Skip tipeList karena sudah di header
      
      let formattedValue = rawValue;

      // Formatting Berdasarkan Tipe Data Kamus
      switch(prop.tipeData) {
        case 'angka_format':
          let num = parseFloat(rawValue);
          formattedValue = isNaN(num) ? rawValue : num.toLocaleString('id-ID') + (prop.suffix || '');
          break;
        case 'url':
          let displayUrl = rawValue.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
          formattedValue = `<span class="koordinat-link"><a href="${rawValue}" target="_blank" rel="noopener noreferrer">${displayUrl}</a></span>`;
          break;
        case 'kuantitas_satuan':
          let [angka, satuan, ekstra] = rawValue.split('|');
          let fAngka = parseFloat(angka).toLocaleString('id-ID');
          let fTeks = satuan ? `${fAngka} ${satuan}` : fAngka;
          formattedValue = ekstra ? `${fTeks} (${ekstra})` : fTeks;
          break;
        case 'tanggal':
          let [waktu, presisi] = rawValue.split('|');
          formattedValue = formatWikidataDate(waktu, presisi);
          break;
        case 'angka_waktu':
          let [valAngka, valTahun] = rawValue.split('|');
          let pAngka = parseInt(valAngka).toLocaleString('id-ID');
          formattedValue = valTahun !== 'null' ? `${pAngka} (${valTahun})` : pAngka;
          break;
        case 'item_wiki':
          let [nama, tahun, wikiUrl] = rawValue.split('|');
          let teksNama = (wikiUrl && wikiUrl !== 'kosong') ? `<span class="koordinat-link"><a href="${wikiUrl}" target="_blank">${nama}</a></span>` : nama;
          formattedValue = tahun !== 'null' ? `${teksNama} (sejak ${tahun})` : teksNama;
          break;
        case 'daftar_label':
          formattedValue = rawValue.toLowerCase(); // Lowercase untuk gaya/fasilitas
          break;
      }
      
      html += `<p>${prop.labelUI}: ${formattedValue}</p>`;
    });
  }

  let tautanTambah = `<p><a href="${wikiBaseUrl}" target="_blank" class="sunting-linktambah" style="font-style: italic;">Lengkapi data di Wikidata!</a></p>`;
  html += tautanTambah;

  container.insertAdjacentHTML('beforebegin', html);
  container.remove();
}

function populateProvinceIndex() {
  if (!ProvinceIndex['all']) ProvinceIndex['all'] = new ProvinceIndexEntry();
  Object.values(Records).forEach(record => {
    ProvinceIndex['all'].total++;
    Object.keys(record.designations).forEach(provQid => {
      if (ProvinceIndex[provQid]) ProvinceIndex[provQid].total++;
    });
  });
}

function populateMapAndIndex() {
  let mapMarkers = [];
  Object.entries(Records).forEach(entry => {
    let qid = entry[0], record = entry[1];
    
    if (!record.isCompound && record.lat && record.lon) {
      let mapMarker = L.marker([record.lat, record.lon], { icon: ikonTetesanAir });
      record.mapMarker = mapMarker;
      mapMarker.bindPopup(record.title, { closeButton: false, maxWidth: 200 });

      mapMarker.togglePopup = function() { if (!this.isPopupOpen()) this.openPopup(); };
      mapMarker.on('mousedown touchstart', function() { this._bukaSaatDisentuh = this.isPopupOpen(); });
      mapMarker.on('click', function() {
        if (this._bukaSaatDisentuh && typeof window.setMobilePanelExpanded === 'function') {
          window.setMobilePanelExpanded(true, true);
        }
      });
      mapMarker.on('dblclick', function(e) {
        L.DomEvent.stopPropagation(e);
        if (typeof window.setMobilePanelExpanded === 'function') window.setMobilePanelExpanded(true, true);
      });
      
      let popup = mapMarker.getPopup();
      popup._qid = qid;
      record.popup = popup;
      mapMarkers.push(mapMarker);
    }
    
    let li = document.createElement('li');
    let a = document.createElement('a');
    a.href = '#' + qid;
    a.textContent = record.indexTitle; 
    li.appendChild(a);
    record.indexLi = li;
  });
  
  populateProvinceIndexNodes(); 
  generateFilterSelect();
}

function populateProvinceIndexNodes() {
  Object.values(Records).forEach(record => {
    if (record.mapMarker) ProvinceIndex['all'].mapMarkers.push(record.mapMarker);
    ProvinceIndex['all'].indexLis.push(record.indexLi);
    
    Object.keys(record.designations).forEach(provQid => {
      if (record.mapMarker && ProvinceIndex[provQid]) ProvinceIndex[provQid].mapMarkers.push(record.mapMarker);
      if (ProvinceIndex[provQid]) ProvinceIndex[provQid].indexLis.push(record.indexLi);
    });
  });
  
  Object.values(ProvinceIndex).forEach(indexItem => {
    indexItem.indexLis = indexItem.indexLis.map(li => [li, li.textContent]).sort((a, b) => a[1] > b[1] ? 1 : -1).map(item => item[0]);
  });
}

var currentRegionFilter = 'all';
var currentUsiaFilter = 'all';
var activeFeatures = new Set(); 
var currentSearchQuery = '';
var userLocation = null;
var userRadiusCircle = null;

function generateFilterSelect() {
  currentRegionFilter = 'all';
  currentUsiaFilter = 'all';
  activeFeatures.clear();
  currentSearchQuery = '';

  let selectKombinasi = document.getElementById('filter-sort-kombinasi');
  if (selectKombinasi) selectKombinasi.value = 'default';

  let searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  let btnAll = document.getElementById('btn-all');
  if (btnAll) btnAll.classList.add('active');
  document.querySelectorAll('.feat-btn:not(#btn-all)').forEach(b => b.classList.remove('active'));

  let selectRegion = document.getElementById('filter-region');
  selectRegion.innerHTML = `<option value="all">Semua Wilayah – ${ProvinceIndex['all'].total}</option>`;
  selectRegion.innerHTML += `<option value="terdekat">Sekitar Anda (10 km)</option>`;
  
  Object.keys(ProvinceIndex)
    .filter(qid => qid !== 'all')
    .map(qid => ({ qid: qid, name: ProvinceIndex[qid].name, total: ProvinceIndex[qid].total }))
    .sort((a, b) => (a.name === 'Wilayah Lainnya/Tidak Spesifik' ? 1 : (b.name === 'Wilayah Lainnya/Tidak Spesifik' ? -1 : a.name.localeCompare(b.name))))
    .forEach(prov => {
      let option = document.createElement('option');
      option.value = prov.qid;
      option.textContent = `${prov.name} – ${prov.total}`;
      selectRegion.appendChild(option);
    });

  applyIntersectionFilter();
  
  if (!isFilterEventAttached) {
    selectRegion.addEventListener('change', function() {
      if (this.value === 'terdekat') jalankanFilterGPS(this);
      else { currentRegionFilter = this.value; userLocation = null; applyIntersectionFilter(); }
    });

    if (selectKombinasi) {
      selectKombinasi.addEventListener('change', function() {
        let pilihan = this.value;
        currentUsiaFilter = 'all'; 
        if (pilihan === 'filter-usia-muda-50') currentUsiaFilter = 'muda_50';
        else if (pilihan === 'filter-usia-50') currentUsiaFilter = 'usia_50'; 
        else if (pilihan === 'filter-usia-100') currentUsiaFilter = 'usia_100'; 
        else if (pilihan === 'filter-usia-200') currentUsiaFilter = 'usia_200'; 
        else if (pilihan === 'filter-usia-300') currentUsiaFilter = 'usia_300'; 
        applyIntersectionFilter();
      });
    }

    if (btnAll) {
      btnAll.addEventListener('click', function() {
        userLocation = null;
        if (window.TombolGPSMap) window.TombolGPSMap.stop();
        if (userRadiusCircle) Map.removeLayer(userRadiusCircle);
        
        activeFeatures.clear();
        btnAll.classList.add('active');
        document.querySelectorAll('.feat-btn:not(#btn-all)').forEach(b => b.classList.remove('active'));

        currentRegionFilter = 'all';
        if (selectRegion) selectRegion.value = 'all';

        currentUsiaFilter = 'all';
        if (selectKombinasi) selectKombinasi.value = 'default';

        currentSearchQuery = '';
        if (searchInput) searchInput.value = '';

        applyIntersectionFilter();
      });
    }

    document.querySelectorAll('.feat-btn:not(#btn-all)').forEach(btn => {
      btn.addEventListener('click', function() {
        let filterType = this.getAttribute('data-filter');
        if (activeFeatures.has(filterType)) {
          activeFeatures.delete(filterType);
          this.classList.remove('active');
        } else {
          activeFeatures.add(filterType);
          this.classList.add('active');
        }
        if (activeFeatures.size === 0 && btnAll) btnAll.classList.add('active');
        else if (btnAll) btnAll.classList.remove('active');
        applyIntersectionFilter();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        currentSearchQuery = this.value.toLowerCase();
        if (searchDebounceToken) clearTimeout(searchDebounceToken);
        searchDebounceToken = setTimeout(() => applyIntersectionFilter(), 300);
      });
    }

    isFilterEventAttached = true; 
  }
}

function updateFeatureCounts(totalValidRecords) {
  let searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = `Menampilkan ${totalValidRecords} hasil (atau ketik pencarian)`;
}

function applyIntersectionFilter(preventZoom = false) {
  if (!PrimaryDataIsLoaded) return;
  Cluster.clearLayers();
  document.getElementById('index-list').innerHTML = '';

  let validMarkers = [];
  let btnAll = document.getElementById('btn-all');
  if (btnAll) {
    if (currentSearchQuery.trim() === '' && currentRegionFilter === 'all' && currentUsiaFilter === 'all' && activeFeatures.size === 0) {
      btnAll.classList.add('active'); btnAll.textContent = 'Semua Hasil'; 
    } else {
      btnAll.classList.remove('active'); btnAll.textContent = 'Pulihkan'; 
    }
  }

  let validRecords = Object.values(Records).filter(record => {
    let matchRegion = false;
    if (currentRegionFilter === 'all') matchRegion = true;
    else if (currentRegionFilter === 'terdekat') {
      if (userLocation && record.lat && record.lon) {
        let jarakMeter = Map.distance([userLocation.lat, userLocation.lon], [record.lat, record.lon]);
        if (jarakMeter <= 10000) matchRegion = true;
      }
    } else matchRegion = record.areaTags.has(currentRegionFilter);

    let matchFeature = true;
    if (activeFeatures.size > 0) {
      if (activeFeatures.has('image') && !record.imageFilename) matchFeature = false;
      if (activeFeatures.has('article') && record.articleTitle === undefined) matchFeature = false;
    }

    let matchSearch = true;
    if (currentSearchQuery.trim() !== '') {
      let cleanQuery = currentSearchQuery.replace(/[-'\s]/g, '');
      if (record.indexTitle) matchSearch = record.indexTitle.toLowerCase().replace(/[-'\s]/g, '').includes(cleanQuery);
      else matchSearch = false;
    }

    let matchUsia = true;
    if (currentUsiaFilter !== 'all') {
      if (record.rawTahunBerdiri) {
        let tahunBangunan = parseInt(record.rawTahunBerdiri.substring(0, 4));
        let [tipeFilter, umurStr] = currentUsiaFilter.split('_');
        let batasTahun = new Date().getFullYear() - parseInt(umurStr);
        matchUsia = (tipeFilter === 'muda') ? (tahunBangunan > batasTahun) : (tahunBangunan <= batasTahun);
      } else matchUsia = false; 
    }
    
    return matchRegion && matchFeature && matchSearch && matchUsia;
  }).sort((a, b) => {
    if (currentUsiaFilter !== 'all') {
      let aHasYear = !!a.rawTahunBerdiri, bHasYear = !!b.rawTahunBerdiri;
      if (aHasYear && bHasYear) return a.rawTahunBerdiri.localeCompare(b.rawTahunBerdiri);
      else if (aHasYear && !bHasYear) return -1; 
      else if (!aHasYear && bHasYear) return 1;  
    }
    return a.indexTitle.localeCompare(b.indexTitle);    
  });

  currentFilteredRecords = validRecords;
  currentRenderIndex = 0; 
  renderNextChunk();
  updateFeatureCounts(validRecords.length);

  if (renderTimeoutToken) clearTimeout(renderTimeoutToken);
  renderTimeoutToken = setTimeout(() => {
    validRecords.forEach(record => { if (record.mapMarker) validMarkers.push(record.mapMarker); });
    if (validMarkers.length > 0) {
      Cluster.addLayers(validMarkers);
      if (!preventZoom) Map.flyToBounds(Cluster.getBounds(), { duration: 0.5 });
    }
    renderTimeoutToken = null; 
  }, 150); 
}

function generateRecordDetails(qid) {
  let record = Records[qid];
  let titleHtml = `<h1>${record.title}</h1>`;
  let figureHtml = generateFigure(record.imageFilename, record.title);
  if (record.imageFilename) figureHtml = figureHtml.replace('<figure class="', '<figure class="gambar-utama ');

  let articleHtml;
  if (record.articleTitle) articleHtml = '<div class="article main-text loading"><div class="loader"></div></div>';
  else {
    let namaAmanURL = encodeURIComponent(record.title);
    let gFormUrl = `https://docs.google.com/forms/d/e/1FAIpQLSeHMSn6cwcgbZ0xx1CJ5tGXDQacYgzRZUG51STByKUROWXgmg/viewform?usp=pp_url&entry.2138396049=${namaAmanURL}`;
    articleHtml = `<div class="article main-text nodata"><p>Situs ini belum memiliki artikel. <a href="${gFormUrl}" target="_blank" rel="noopener noreferrer" class="sunting-linktambah">Tambahkan!</a></p></div>`;
  }
  
  let wikiUrlUtama = `https://www.wikidata.org/wiki/${qid}`;
  let tautanSunting = `<a href="${wikiUrlUtama}" target="_blank" class="sunting-link" title="Sunting data di Wikidata"></a>`;
  let designationsHtml = `<h2 style="margin-top:10px;display:flex;justify-content:space-between;"><div><span id="header-text-${qid}" style="margin-right:7px;">Informasi</span>${tautanSunting}</div></h2><ul class="designations">`;

  // Mengambil konfigurasi dasar dari Kamus Data-Driven
  let config = KonfigurasiKlaster[currentClusterKey || 'custom'] || KonfigurasiKlaster['custom'];
  let prefixLokasi = config.infoDasar.prefixLokasi || 'Lokasi';
  let prefixTahun = config.infoDasar.prefixTahun || 'Tahun';
  let showTahun = config.infoDasar.tampilkanTahun;

  let arrayProvinsi = Object.values(record.designations);
  let isTidakSpesifik = arrayProvinsi.includes('Wilayah Lainnya/Tidak Spesifik') || arrayProvinsi.length === 0;
  let spesifik = record.lokasiSpesifik; 
  if (spesifik === 'Wilayah Lainnya/Tidak Spesifik') spesifik = null;
  
  let namaLokasi = isTidakSpesifik 
    ? (spesifik ? spesifik : 'Belum ada data') 
    : (spesifik && !arrayProvinsi.filter(p => p !== 'Wilayah Lainnya/Tidak Spesifik').map(p => p.toLowerCase()).includes(spesifik.toLowerCase()) ? `${spesifik}, ${arrayProvinsi.filter(p => p !== 'Wilayah Lainnya/Tidak Spesifik').join(', ')}` : arrayProvinsi.filter(p => p !== 'Wilayah Lainnya/Tidak Spesifik').join(', '));

  let infoLokasiHtml = (record.lat && record.lon)
    ? `<p class="koordinat-link">${prefixLokasi}: <a href="https://www.google.com/maps?q=${record.lat},${record.lon}" target="_blank">${namaLokasi}</a></p>`
    : `<p class="koordinat-link">${prefixLokasi}: ${namaLokasi}</p><p>Koordinat: <span style="font-style: italic; color: #888;">Data belum tersedia</span></p>`;

  let infoTahunHtml = showTahun ? `<p>${prefixTahun}: ${record.tahunBerdiri || '<span style="font-style: italic; color: #888;">Data belum tersedia</span>'}</p>` : '';

  let eventsHtmlPlaceholder = `<div id="events-container-${qid}" class="loading"><div class="loader" style="width: 20px; height: 20px; border-width: 2px; margin-top: 2px;"></div></div>`;
  designationsHtml += `<li>${infoLokasiHtml}${infoTahunHtml}${eventsHtmlPlaceholder}</li></ul>`;
  
  let arsipHtml = `<div id="arsip-container-${qid}" class="loading"><div class="loader" style="width: 20px; height: 20px; border-width: 2px; margin-top: 8px;"></div></div>`;

  let panelElem = document.createElement('div');
  panelElem.innerHTML = titleHtml + figureHtml + articleHtml + designationsHtml + arsipHtml;
  record.panelElem = panelElem;

  if (record.articleTitle) displayArticleExtract(record.articleTitle, panelElem.querySelector('.article'));
  queryOsm(qid);
}

function populateHistoricalImagesData(qid) {
  let record = Records[qid];
  let queryStr = getSparqlQuery5(qid); 
  record.vicinityImages = [];
  
  return queryWdqsThenProcess(
    queryStr,
    function(result) {
      if ('vicinityImage' in result) {
        let filename = extractImageFilename(result.vicinityImage);
        if (!record.vicinityImages.some(img => img.file === filename)) record.vicinityImages.push({ file: filename, caption: result.vicinityCaption ? result.vicinityCaption.value : '' });
      }
      if ('pastImage' in result && !record.pastImage) record.pastImage = { file: extractImageFilename(result.pastImage), caption: result.pastCaption ? result.pastCaption.value : '' };
      if ('interiorImage' in result && !record.interiorImage) record.interiorImage = { file: extractImageFilename(result.interiorImage), caption: result.interiorCaption ? result.interiorCaption.value : '' };
      if ('commonsCat' in result) record.commonsCat = result.commonsCat.value;
    },
    function() { renderHistoricalImagesInPanel(qid); }
  ).catch(error => {
    record._gagalOffline = true; 
    let arsipContainer = record.panelElem?.querySelector(`#arsip-container-${qid}`);
    if (arsipContainer) arsipContainer.remove(); 
  });
}

function renderHistoricalImagesInPanel(qid) {
  let record = Records[qid];
  if (!record.panelElem) return;
  let container = record.panelElem.querySelector(`#arsip-container-${qid}`);
  if (!container) return; 

  let html = '';
  function buildImageBlock(imgObj, teksPengganti) {
    let block = '<div class="arsip-block" style="overflow: hidden;">' + generateFigure(imgObj.file);
    block += (imgObj.caption && imgObj.caption.trim() !== '') ? `<div class="article main-text"><p>${imgObj.caption}</p></div>` : `<div class="article main-text nodata"><p>${teksPengganti}</p></div>`;
    return block + '</div>';
  }

  if (record.pastImage) html += buildImageBlock(record.pastImage, 'Tampilan sebelumnya');
  if (record.interiorImage) html += buildImageBlock(record.interiorImage, 'Pemandangan di dalam');
  if (record.vicinityImages && record.vicinityImages.length > 0) record.vicinityImages.forEach(img => html += buildImageBlock(img, 'Objek sekitar'));

  if (record.commonsCat) {
    html += '<h2 style="margin-top:10px; margin-bottom: 7px;">Galeri lainnya</h2>' +
            `<p class="wikipedia-link" style="margin-bottom: 0;"><a href="https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(record.commonsCat)}" target="_blank"><img src="img/wikicommons_tiny_logo.png" alt="" /><span>Lihat di Wikimedia Commons</span></a></p>`;
  }

  if (html !== '') {
    let tautanSuntingGaleri = `<a href="https://www.wikidata.org/wiki/${qid}#P18" target="_blank" class="sunting-link" title="Sunting galeri di Wikidata"></a>`;
    let judulGaleriUtama = (record.pastImage || record.interiorImage || record.vicinityImages.length > 0) ? `<h2 style="margin-top:10px;margin-bottom:10px;">Galeri ${tautanSuntingGaleri}</h2>` : '';
    container.innerHTML = judulGaleriUtama + html;
    container.classList.remove('loading');
  } else {
    container.remove();
  }
}

function displayArticleExtract(title, elem) {
  let url = new URL('https://id.wikipedia.org/w/api.php');
  let params = { action: 'query', format: 'json', prop: 'extracts', exintro: 1, redirects: true, titles: title, origin: '*' };
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  fetch(url, { signal: globalFetchController.signal })
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(data => {
      let rawExtract = Object.values(data.query.pages)[0].extract || '';
      let kumpulanParagraf = rawExtract.match(/<p[^>]*>[\s\S]+?<\/p>/g);
      let paragrafPilihan = kumpulanParagraf ? kumpulanParagraf.find(text => text.length > 50) : '<p>Ringkasan artikel belum memadai.</p>';

      if (paragrafPilihan.includes('<p>')) {
        paragrafPilihan = paragrafPilihan.replace(/^<p[^>]*>(\s|<br\s*\/?>| )*/i, '<p>')
                                         .replace(/<span[^>]*>[^<]*code:\s*[a-z\-]+\s*is deprecated[^<]*<\/span>/gi, '')
                                         .replace(/<[^>]*>[^<]*(is deprecated|Lua error|Script error)[^<]*<\/[^>]*>/gi, '')
                                         .replace(/code:\s*[a-z\-]+\s*is deprecated/gi, '');
      }
      if (elem) {
        elem.innerHTML = paragrafPilihan + `<p class="wikipedia-link"><a href="https://id.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank"><img src="img/wikipedia_tiny_logo.png" alt="" /><span>Baca selengkapnya di Wikipedia</span></a></p>`;
        elem.classList.remove('loading');
      }
    })
    .catch(error => {
      if (error.name === 'AbortError') return;
      if (elem) {
        elem.innerHTML = '<p class="nodata" style="color:#cc0000; margin-top:10px;">Gagal memuat ringkasan artikel.</p>';
        elem.classList.remove('loading');
      }
    });
}

function renderNextChunk() {
  let ol = document.getElementById('index-list');
  if (!ol) return;
  let nextBatch = currentFilteredRecords.slice(currentRenderIndex, currentRenderIndex + CHUNK_SIZE);  
  if (nextBatch.length === 0) return;
  
  let fragment = document.createDocumentFragment();
  nextBatch.forEach(record => {
    if (record.indexLi) { record.indexLi.style.display = ''; fragment.appendChild(record.indexLi); }
  });
  ol.appendChild(fragment);
  currentRenderIndex += CHUNK_SIZE; 
}

let scrollContainer = document.getElementById('index-container'); 
if (scrollContainer) {
  scrollContainer.addEventListener('scroll', function() {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 10) renderNextChunk(); 
  });
}

function queryOsm(qid) {
  let signal = typeof globalFetchController !== 'undefined' ? globalFetchController.signal : null;
  let queryStr = `[out:json][timeout:25];\n(\n  way["wikidata"="${qid}"];\n  relation["wikidata"="${qid}"];\n);\nout body;\n>;\nout skel qt;`;
  
  fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(queryStr), { signal: signal })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(data => {
      if (typeof osmtogeojson !== 'function') return; 
      let geoJson = osmtogeojson(data);
      if (!geoJson || geoJson.features.length === 0) return;
      
      let shapeLayer = L.geoJSON(geoJson, { style: { color: '#ff3333', opacity: 0.7, fill: true }, filter: feature => feature.geometry.type !== 'Point' });
      Records[qid].shapeLayer = shapeLayer;

      if (window.location.hash.replace('#', '') === qid) {
        if (currentActiveShapeLayer) Map.removeLayer(currentActiveShapeLayer);
        shapeLayer.addTo(Map);
        currentActiveShapeLayer = shapeLayer;
      }
    })
    .catch(err => { if (err.name !== 'AbortError') console.warn('Gagal memuat OSM:', err); });
}

class ProvinceIndexEntry { constructor() { this.name = ''; this.total = 0; this.mapMarkers = []; this.indexLis = []; } }
class Record {
  constructor(isCompound) {
    this.isCompound = isCompound; this.title = undefined; this.imageFilename = ''; this.articleTitle = undefined;
    this.designations = {}; this.panelElem = undefined; this.indexLi = undefined; this.tahunBerdiri = undefined;
    this.rawTahunBerdiri = undefined; this.events = []; this.areaTags = new Set(); this.vicinityImages = []; this.interiorImage = undefined;
  }
}
class SimpleRecord extends Record {
  constructor() { super(false); this.lat = undefined; this.lon = undefined; this.mapMarker = undefined; this.popup = undefined; this.shapeLayer = undefined; }
}
class CompoundRecord extends Record { constructor() { super(true); this.parts = []; } }
