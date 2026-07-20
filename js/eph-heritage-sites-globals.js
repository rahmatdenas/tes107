'use strict';
const BASE_TITLE = 'WikiJelajah';

// =========================================================================
// KAMUS KONFIGURASI (DATA-DRIVEN ARCHITECTURE)
// =========================================================================
const KonfigurasiKlaster = {
  // 1. Klaster Bangunan Bersejarah & Fasilitas
  "bangunan_umum": {
    "infoDasar": {
      "prefixLokasi": "Letak",
      "prefixTahun": "Didirikan",
      "tampilkanTahun": true,
      "pidLokasi": "P131",
      "pidTahun": "P571"
    },
    "properti": [
      { "id": "tipeList",     "pid": "P31",   "tipeData": "daftar_label",     "labelUI": "Tipe Bangunan" },
      { "id": "arsitek",      "pid": "P84",   "tipeData": "label",            "labelUI": "Arsitek" },
      { "id": "gayaList",     "pid": "P149",  "tipeData": "daftar_label",     "labelUI": "Gaya Arsitektur" },
      { "id": "kapasitas",    "pid": "P1083", "tipeData": "angka_format",     "labelUI": "Kapasitas" },
      { "id": "kondisi",      "pid": "P5817", "tipeData": "label",            "labelUI": "Kondisi Saat Ini" },
      { "id": "luas",         "pid": "P2046", "tipeData": "kuantitas_satuan", "labelUI": "Luas" },
      { "id": "fasilitasList","pid": "P912",  "tipeData": "daftar_label",     "labelUI": "Fasilitas" },
      { "id": "lamanResmi",   "pid": "P856",  "tipeData": "url",              "labelUI": "Situs Web" }
    ]
  },

  // 2. Klaster Karya Naskah, Prasasti, Artefak
  "karya_naskah": {
    "infoDasar": {
      "prefixLokasi": "Koleksi/Lokasi",
      "prefixTahun": "Tarikh/Dibuat",
      "tampilkanTahun": true,
      "pidLokasi": "P276",
      "pidTahun": "P571"
    },
    "properti": [
      { "id": "pencipta",     "pid": "P170",  "tipeData": "label",            "labelUI": "Pencipta/Penulis" },
      { "id": "bahanList",    "pid": "P186",  "tipeData": "daftar_label",     "labelUI": "Material Dasar" },
      { "id": "aksaraList",   "pid": "P282",  "tipeData": "daftar_label",     "labelUI": "Sistem Penulisan" },
      { "id": "bahasaList",   "pid": "P407",  "tipeData": "daftar_label",     "labelUI": "Bahasa" },
      { "id": "panjang",      "pid": "P2043", "tipeData": "kuantitas_satuan", "labelUI": "Panjang" },
      { "id": "lebar",        "pid": "P2049", "tipeData": "kuantitas_satuan", "labelUI": "Lebar" },
      { "id": "tglTemu",      "pid": "P575",  "tipeData": "tanggal",          "labelUI": "Tanggal Penemuan" },
      { "id": "tempatTemu",   "pid": "P189",  "tipeData": "label",            "labelUI": "Lokasi Penemuan" }
    ]
  },

  // 3. Klaster Wilayah Administratif
  "wilayah_admin": {
    "infoDasar": {
      "prefixLokasi": "Provinsi/Negara",
      "prefixTahun": "Hari Jadi",
      "tampilkanTahun": true,
      "pidLokasi": "P131",
      "pidTahun": "P571"
    },
    "properti": [
      { "id": "populasi",     "pid": "P1082", "tipeData": "angka_waktu",      "labelUI": "Jumlah Penduduk" },
      { "id": "kepalaDaerah", "pid": "P6",    "tipeData": "item_wiki",        "labelUI": "Kepala Daerah" },
      { "id": "luas",         "pid": "P2046", "tipeData": "kuantitas_satuan", "labelUI": "Luas Wilayah" },
      { "id": "ketinggian",   "pid": "P2044", "tipeData": "angka_format",     "labelUI": "Ketinggian (mdpl)" },
      { "id": "lamanResmi",   "pid": "P856",  "tipeData": "url",              "labelUI": "Situs Web Resmi" }
    ]
  },

  // 4. Klaster Geografis & Alam (Tidak butuh tahun berdiri)
  "bentang_alam": {
    "infoDasar": {
      "prefixLokasi": "Letak",
      "prefixTahun": null,
      "tampilkanTahun": false,
      "pidLokasi": "P131",
      "pidTahun": "P571"
    },
    "properti": [
      { "id": "pegunungan",   "pid": "P4552", "tipeData": "label",            "labelUI": "Bagian dari Pegunungan" },
      { "id": "ketinggian",   "pid": "P2044", "tipeData": "angka_format",     "labelUI": "Ketinggian (mdpl)" },
      { "id": "luas",         "pid": "P2046", "tipeData": "kuantitas_satuan", "labelUI": "Luas Area" }
    ]
  },

  // Kustom Fallback (Jika pengguna input custom ID)
  "custom": {
    "infoDasar": {
      "prefixLokasi": "Lokasi",
      "prefixTahun": "Tahun",
      "tampilkanTahun": true,
      "pidLokasi": "P131",
      "pidTahun": "P571"
    },
    "properti": [
      { "id": "tipeList",     "pid": "P31",   "tipeData": "daftar_label",     "labelUI": "Tipe" }
    ]
  }
};


// =========================================================================
// KUERI DASAR LOKASI & TITIK PETA
// =========================================================================
const KUMPULAN_KUERI_0 = {
'universal': `SELECT DISTINCT ?SQ ?sLabel ?PQ ?pLabel ?LQ ?lLabel ?tM ?tP
WHERE {
  {
    SELECT DISTINCT ?s ?p ?l WHERE {
      VALUES ?j { <PLACEHOLDER_JENIS> }
      <PLACEHOLDER_KURUNG_BUKA>
      <PLACEHOLDER_WILAYAH_1>
      ?s wdt:P31 ?j ;
         wdt:<PLACEHOLDER_PROP_LOKASI> ?l .
      <PLACEHOLDER_HIERARKI_LOKASI>
      <PLACEHOLDER_KURUNG_TUTUP>
      <PLACEHOLDER_UNION_EKSTRA>
    }
    ORDER BY ?s ?p ?l
    <PLACEHOLDER_LIMIT_OFFSET>
  }
  OPTIONAL {
    ?s p:<PLACEHOLDER_PROP_TAHUN> ?iS .
    ?iS psv:<PLACEHOLDER_PROP_TAHUN> ?iN .
    ?iN wikibase:timeValue ?tM ;
        wikibase:timePrecision ?tP .
  }
  BIND(SUBSTR(STR(?s), 32) AS ?SQ) .
  BIND(SUBSTR(STR(?p), 32) AS ?PQ) .
  BIND(SUBSTR(STR(?l), 32) AS ?LQ)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
}`,

'khusus_negara_all': `SELECT DISTINCT ?SQ ?sLabel ?PQ ?pLabel ?lLabel ?tM ?tP
WHERE {
<PLACEHOLDER_FILTER_NASIONAL>
?s wdt:P31 ?j .
VALUES ?j { <PLACEHOLDER_JENIS> }
OPTIONAL {
?p wdt:P31 wd:Q5098 .
?s wdt:<PLACEHOLDER_PROP_LOKASI> ?l .
?l wdt:P131* ?p .
}
OPTIONAL {
?s p:<PLACEHOLDER_PROP_TAHUN> ?iS .
?iS psv:<PLACEHOLDER_PROP_TAHUN> ?iN .
?iN wikibase:timeValue ?tM ;
    wikibase:timePrecision ?tP .
}
BIND(SUBSTR(STR(?s), 32) AS ?SQ) .
BIND(SUBSTR(STR(?p), 32) AS ?PQ) .
SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
}`,

'apapun': `SELECT DISTINCT ?SQ ?sLabel ?PQ ?pLabel ?LQ ?lLabel ?tM ?tP
WHERE {
  {
    SELECT DISTINCT ?s ?p ?l WHERE {
      <PLACEHOLDER_KURUNG_BUKA>
      <PLACEHOLDER_WILAYAH_1>
      ?s wdt:P17 wd:Q252 ;
         wdt:P625 [] ;
         wdt:P18 [] ;
         wdt:P131 ?l .
      <PLACEHOLDER_HIERARKI_LOKASI>
      <PLACEHOLDER_KURUNG_TUTUP>
      <PLACEHOLDER_UNION_EKSTRA>
    }
    ORDER BY ?s ?p ?l
    <PLACEHOLDER_LIMIT_OFFSET>
  }
  OPTIONAL {
    ?s p:<PLACEHOLDER_PROP_TAHUN> ?iS .
    ?iS psv:<PLACEHOLDER_PROP_TAHUN> ?iN .
    ?iN wikibase:timeValue ?tM ;
        wikibase:timePrecision ?tP .
  }
  BIND(SUBSTR(STR(?s), 32) AS ?SQ) .
  BIND(SUBSTR(STR(?p), 32) AS ?PQ) .
  BIND(SUBSTR(STR(?l), 32) AS ?LQ)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
}`,

'luar_negeri': `SELECT DISTINCT ?SQ ?sLabel ?PQ ?pLabel ?LQ ?lLabel ?tM ?tP
WHERE {
  {
    SELECT DISTINCT ?s ?p ?l WHERE {
      VALUES ?j { <PLACEHOLDER_JENIS> }
      ?s wdt:P17 <PLACEHOLDER_NEGARA> ;
         wdt:P31 ?j ;
         wdt:<PLACEHOLDER_PROP_LOKASI> ?l .
      OPTIONAL {
        ?l wdt:P131* ?p .
        ?p wdt:P131 <PLACEHOLDER_NEGARA> .
      }
    }
    ORDER BY ?s ?p ?l
    <PLACEHOLDER_LIMIT_OFFSET>
  }
  OPTIONAL {
    ?s p:<PLACEHOLDER_PROP_TAHUN> ?iS .
    ?iS psv:<PLACEHOLDER_PROP_TAHUN> ?iN .
    ?iN wikibase:timeValue ?tM ;
        wikibase:timePrecision ?tP .
  }
  BIND(SUBSTR(STR(?s), 32) AS ?SQ) .
  BIND(SUBSTR(STR(?p), 32) AS ?PQ) .
  BIND(SUBSTR(STR(?l), 32) AS ?LQ)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
}`
};

const KUMPULAN_KUERI_1 = {
'universal': `SELECT DISTINCT ?siteQid ?coord WHERE {
VALUES ?site { <PLACEHOLDER_QIDS> }
<PLACEHOLDER_KLAUSA_KOORDINAT>
?coordStatement ps:P625 ?coord .
FILTER NOT EXISTS { ?coordStatement pq:P518 ?x }
BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
}`
};

const SPARQL_QUERY_3_TEMPLATE =
`SELECT ?siteQid (SAMPLE(?imgUtama) AS ?image) (SAMPLE(?wikiTitle) AS ?wikipediaUrlTitle) WHERE {
  VALUES ?site { <PLACEHOLDER_QIDS> }
  OPTIONAL {
    ?site p:P18 ?imageStatement .
    ?imageStatement ps:P18 ?imgUtama .
    FILTER NOT EXISTS { ?imageStatement pq:P3831 wd:Q16189205 }
    FILTER NOT EXISTS { ?imageStatement pq:P180 wd:Q192630 }
  }
  OPTIONAL {
    ?wikipedia schema:about ?site ;
               schema:isPartOf <https://id.wikipedia.org/> .
    BIND (SUBSTR(STR(?wikipedia), 31) AS ?wikiTitle) .
  }
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
} GROUP BY ?siteQid`;

function getSparqlQuery4(qid) {
return `SELECT ?siteQid ?eventLabel ?pointInTime ?ptPrecision ?startTime ?stPrecision ?endTime ?etPrecision WHERE {
VALUES ?site { wd:${qid} }
?site p:P793 ?eventStatement .
?eventStatement ps:P793 ?event .
?event rdfs:label ?eventLabel . 
FILTER(LANG(?eventLabel) = "id" || LANG(?eventLabel) = "en") .
OPTIONAL { 
?eventStatement pqv:P585 ?ptNode .
?ptNode wikibase:timeValue ?pointInTime ;
        wikibase:timePrecision ?ptPrecision .
}
OPTIONAL { 
?eventStatement pqv:P580 ?stNode .
?stNode wikibase:timeValue ?startTime ;
        wikibase:timePrecision ?stPrecision .
}
OPTIONAL { 
?eventStatement pqv:P582 ?etNode .
?etNode wikibase:timeValue ?endTime ;
        wikibase:timePrecision ?etPrecision .
}
BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
}`;
}

function getSparqlQuery5(qid) {
return `SELECT ?siteQid ?vicinityImage ?vicinityCaption ?pastImage ?pastCaption ?interiorImage ?interiorCaption ?commonsCat WHERE {
VALUES ?site { wd:${qid} }
OPTIONAL { ?site wdt:P373 ?commonsCat . }
OPTIONAL {
?site p:P18 ?vicinityStatement .
?vicinityStatement ps:P18 ?vicinityImage .
FILTER EXISTS { ?vicinityStatement pq:P3831 wd:Q16189205 }
OPTIONAL {
?vicinityStatement pq:P2096 ?vicinityCaption .
FILTER(LANG(?vicinityCaption) = "id")
}
}
OPTIONAL {
?site p:P18 ?pastImgStmt .
?pastImgStmt ps:P18 ?pastImage .
?pastImgStmt pq:P180 wd:Q192630 .
OPTIONAL {
?pastImgStmt pq:P2096 ?pastCaption .
FILTER(LANG(?pastCaption) = "id")
}
}
OPTIONAL {
?site p:P5775 ?interiorStmt .
?interiorStmt ps:P5775 ?interiorImage .
OPTIONAL {
?interiorStmt pq:P2096 ?interiorCaption .
FILTER(LANG(?interiorCaption) = "id")
}
}
BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
} LIMIT 1`;
}

// =========================================================================
// MESIN PEMBANGUN KUERI DINAMIS (DYNAMIC QUERY BUILDER)
// Menggantikan kueri if-else raksasa yang rentan timeout.
// =========================================================================
function buildDynamicSparqlQuery(qid) {
  // Ambil kunci klaster dari JS 1 (fallback ke custom jika tidak terdaftar)
  let kunci = typeof currentClusterKey !== 'undefined' && KonfigurasiKlaster[currentClusterKey] 
                ? currentClusterKey : 'custom';
  let config = KonfigurasiKlaster[kunci];

  let selectClause = `SELECT ?siteQid `;
  let whereClause = `VALUES ?site { wd:${qid} }\n`;

  config.properti.forEach(prop => {
    let id = prop.id;
    let pid = prop.pid;

    switch (prop.tipeData) {
      case 'label':
        selectClause += `(SAMPLE(?${id}Label) AS ?${id}) `;
        // Menggunakan COALESCE agar jika terjemahan bahasa Indonesia belum ada, label asli tetap diambil
        whereClause += `OPTIONAL { 
          ?site wdt:${pid} ?${id}Item . 
          OPTIONAL { ?${id}Item rdfs:label ?${id}Id . FILTER(LANG(?${id}Id) = "id") }
          BIND(COALESCE(?${id}Id, REPLACE(STR(?${id}Item), "^.*/", "")) AS ?${id}Label)
        }\n`;
        break;

      case 'daftar_label':
        selectClause += `(GROUP_CONCAT(DISTINCT ?${id}Label; separator=", ") AS ?${id}) `;
        whereClause += `OPTIONAL { 
          ?site wdt:${pid} ?${id}Item . 
          OPTIONAL { ?${id}Item rdfs:label ?${id}Id . FILTER(LANG(?${id}Id) = "id") }
          BIND(COALESCE(?${id}Id, REPLACE(STR(?${id}Item), "^.*/", "")) AS ?${id}Label)
        }\n`;
        break;

      case 'angka_format':
        selectClause += `(SAMPLE(?${id}Val) AS ?${id}) `;
        whereClause += `OPTIONAL { ?site wdt:${pid} ?${id}Val . }\n`;
        break;

      case 'url':
        selectClause += `(SAMPLE(?${id}Val) AS ?${id}) `;
        whereClause += `OPTIONAL { ?site wdt:${pid} ?${id}Val . }\n`;
        break;

      case 'kuantitas_satuan':
        selectClause += `(SAMPLE(?${id}Data) AS ?${id}) `;
        whereClause += `OPTIONAL {
          ?site p:${pid} ?${id}Stmt .
          ?${id}Stmt psv:${pid} ?${id}Node .
          ?${id}Node wikibase:quantityAmount ?${id}Val .
          OPTIONAL { ?${id}Node wikibase:quantityUnit ?${id}UnitItem . ?${id}UnitItem rdfs:label ?${id}UnitLabel . FILTER(LANG(?${id}UnitLabel) = "id") }
          BIND(CONCAT(STR(?${id}Val), "|", IF(BOUND(?${id}UnitLabel), ?${id}UnitLabel, "")) AS ?${id}Data)
        }\n`;
        break;

      case 'tanggal':
        selectClause += `(SAMPLE(?${id}Data) AS ?${id}) `;
        whereClause += `OPTIONAL {
          ?site p:${pid} ?${id}Stmt .
          ?${id}Stmt psv:${pid} ?${id}Node .
          ?${id}Node wikibase:timeValue ?${id}Val ; wikibase:timePrecision ?${id}Prec .
          BIND(CONCAT(STR(?${id}Val), "|", STR(?${id}Prec)) AS ?${id}Data)
        }\n`;
        break;

      case 'angka_waktu': // Khusus populasi/penutur: Menggabungkan Angka dengan Tahun pelaporan
        selectClause += `(SAMPLE(?${id}Data) AS ?${id}) `;
        whereClause += `OPTIONAL {
          ?site p:${pid} ?${id}Stmt . ?${id}Stmt ps:${pid} ?${id}Val .
          OPTIONAL { ?${id}Stmt pq:P585 ?${id}Date . }
          BIND(CONCAT(STR(?${id}Val), "|", STR(YEAR(?${id}Date))) AS ?${id}Data)
        }\n`;
        break;

      case 'item_wiki': // Khusus Kepala Daerah / Entitas yang punya Wiki
        selectClause += `(SAMPLE(?${id}Data) AS ?${id}) `;
        whereClause += `OPTIONAL {
          ?site p:${pid} ?${id}Stmt . ?${id}Stmt ps:${pid} ?${id}Item . 
          ?${id}Item rdfs:label ?${id}Label . FILTER(LANG(?${id}Label) = "id")
          OPTIONAL { ?${id}Stmt pq:P580 ?${id}Date . }
          OPTIONAL { ?${id}Wiki schema:about ?${id}Item ; schema:isPartOf <https://id.wikipedia.org/> . }
          BIND(CONCAT(STR(?${id}Label), "|", STR(YEAR(?${id}Date)), "|", IF(BOUND(?${id}Wiki), STR(?${id}Wiki), "kosong")) AS ?${id}Data)
        }\n`;
        break;
    }
  });

  return `${selectClause} WHERE { ${whereClause} BIND (SUBSTR(STR(?site), 32) AS ?siteQid) } GROUP BY ?siteQid`;
}

const ABOUT_SPARQL_QUERY = ``;
