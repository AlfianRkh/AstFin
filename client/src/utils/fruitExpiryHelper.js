/**
 * Fruit & Fresh Produce Shelf-Life Database & Intelligent Expiry Estimator
 * Solusi pelacakan masa simpan buah dan bahan segar yang tidak memiliki tanggal kedaluwarsa pada kemasannya.
 */

export const FRUIT_EXPIRY_DATABASE = [
  {
    id: "pisang",
    name: "Pisang",
    aliases: ["pisang", "banana", "cavendish", "ambon", "raja", "kepok", "sunpride", "mas", "barangan"],
    category: "Buah Tropis",
    icon: "🍌",
    recommendedStorage: "Suhu ruang sampai matang, kulkas jika sudah matang penuh",
    ethylene: "Penghasil Etilen Tinggi (Jauhkan dari buah yang cepat matang)",
    shelfLife: {
      room_temp: {
        unripe: 7, // 5-7 hari
        ripe: 4,   // 3-5 hari
        cut: 1,    // cepat cokelat
      },
      chiller: {
        unripe: 3, // Peringatan: mengganggu pematangan, kulit cepat hitam
        ripe: 7,   // kulit menggelap tetapi daging buah tetap segar 5-7 hari
        cut: 2,    // simpan dalam wadah kedap
      },
      freezer: {
        unripe: 30,
        ripe: 60,  // kupas dulu, potong, simpan untuk smoothie / frozen dessert (2-3 bulan)
        cut: 60,
      },
    },
    storageTips: [
      "Bungkus pangkal tangkai (crown) pisang dengan plastic wrap/aluminium foil untuk memperlambat pelepasan gas etilen.",
      "Gantung pisang atau letakkan melengkung ke atas agar tidak timbul memar akibat tekanan.",
      "Jangan masukkan pisang hijau (mentah) ke kulkas karena suhu dingin menghentikan enzim pematangan secara permanen.",
      "Jika sudah terlalu matang dengan bintik hitam, kupas dan bekukan di freezer untuk bahan smoothie atau bolu pisang.",
    ],
    spoilageSigns: [
      "Daging buah menghitam, sangat lembek berair (mushy), dan mengeluarkan lendir.",
      "Aroma asam menyengat seperti fermentasi alkohol atau bau ragi berlebih.",
      "Muncul spora jamur putih/abu-abu pada pangkal tangkai atau kulit.",
      "Dikerubungi lalat buah secara intensif.",
    ],
  },
  {
    id: "apel",
    name: "Apel",
    aliases: ["apel", "apple", "fuji", "manalagi", "malang", "washington", "royal gala", "granny smith", "envy"],
    category: "Buah Subtropis",
    icon: "🍎",
    recommendedStorage: "Kulkas (Chiller / Crisper Drawer)",
    ethylene: "Penghasil Etilen Sangat Tinggi",
    shelfLife: {
      room_temp: {
        unripe: 14,
        ripe: 7,
        cut: 1,
      },
      chiller: {
        unripe: 45,
        ripe: 30,  // Apel bertahan 3-6 minggu di chiller
        cut: 4,    // rendam air garam/lemon sebelum disimpan
      },
      freezer: {
        unripe: 180,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Simpan di laci sayur/buah kulkas (crisper) bersuhu dingin dan lembap (1-4°C).",
      "Jauhkan dari sayuran hijau dan wortel karena gas etilen apel membuat sayur cepat kuning & pahit.",
      "Untuk apel potong, lumuri atau rendam sebentar dalam air perasan lemon / air garam tipis agar tidak berubah cokelat.",
      "Satu apel busuk bisa menulari sekeranjang; segera pisahkan apel yang memar/luka.",
    ],
    spoilageSigns: [
      "Tekstur mengerut keriput parah, lembek saat ditekan, dan tidak lagi renyah.",
      "Bagian dalam berwarna cokelat tua berair serta aroma apek atau beralkohol.",
      "Bintik-bintik jamur berbulu di sekitar tangkai atau bawah buah.",
    ],
  },
  {
    id: "alpukat",
    name: "Alpukat",
    aliases: ["alpukat", "avocado", "mentega", "hass", "alvocado", "avokad"],
    category: "Buah Tropis",
    icon: "🥑",
    recommendedStorage: "Suhu ruang sampai empuk, lalu pindahkan ke kulkas",
    ethylene: "Sensitif Etilen saat mentah, Penghasil Etilen saat matang",
    shelfLife: {
      room_temp: {
        unripe: 5, // alpukat mentah butuh 3-5 hari di suhu ruang
        ripe: 2,   // setelah empuk hanya bertahan 1-2 hari di suhu ruang
        cut: 1,
      },
      chiller: {
        unripe: 3, // memperlambat pematangan tidak sempurna
        ripe: 5,   // alpukat matang tahan 3-5 hari di chiller
        cut: 2,    // simpan dengan biji terpasang & lumuri air lemon
      },
      freezer: {
        unripe: 30,
        ripe: 90,  // haluskan (puree) dengan sedikit perasan lemon, tahan 3 bulan
        cut: 90,
      },
    },
    storageTips: [
      "Alpukat keras (mentah) WAJIB ditaruh di suhu ruang. Untuk mempercepat matang, masukkan ke kantong kertas bersama pisang/apel.",
      "Jika sudah empuk saat ditekan lembut, segera pindahkan ke kulkas untuk menahan proses pembusukan.",
      "Jika baru dimakan setengah: biarkan biji tetap menempel pada paruh yang disimpan, olesi permukaan dengan air lemon atau minyak zaitun, lalu tutup rapat plastic wrap.",
    ],
    spoilageSigns: [
      "Kulit luar hitam pekat cekung ke dalam dan terasa sangat lembek kopong.",
      "Daging buah berwarna cokelat/hitam pekat merata dengan serat kasar kehitaman.",
      "Aroma tengik, asam kecut, atau berbau kimia fermentasi.",
    ],
  },
  {
    id: "jeruk",
    name: "Jeruk & Lemon",
    aliases: ["jeruk", "orange", "lemon", "jeruk nipis", "nipis", "sunkist", "mandarin", "jeruk medan", "jeruk bali", "lime"],
    category: "Buah Sitrus",
    icon: "🍊",
    recommendedStorage: "Kulkas (Chiller) dalam wadah berventilasi",
    ethylene: "Tidak Terlalu Sensitif Etilen",
    shelfLife: {
      room_temp: {
        unripe: 10,
        ripe: 7,
        cut: 1,
      },
      chiller: {
        unripe: 28,
        ripe: 21,  // 3-4 minggu di chiller
        cut: 4,    // wadah tertutup rapat
      },
      freezer: {
        unripe: 90,
        ripe: 120, // bekukan air perasannya atau irisan kulit
        cut: 90,
      },
    },
    storageTips: [
      "Simpan dalam kantong jaring atau wadah terbuka di kulkas agar ada sirkulasi udara; hindari kantong plastik kedap karena memicu kondensasi dan jamur biru/hijau.",
      "Jangan mencuci jeruk sebelum disimpan; cuci hanya saat hendak dikupas/diperas.",
      "Jeruk utuh di suhu ruang bertahan sekitar 1 minggu, cocok jika ingin segera dikonsumsi.",
    ],
    spoilageSigns: [
      "Kulit melunak becek dan muncul lapisan serbuk jamur berwarna hijau kebiruan (Penicillium).",
      "Kulit mengerut kering keras tanpa ada air di dalamnya.",
      "Aroma asam busuk menyengat.",
    ],
  },
  {
    id: "mangga",
    name: "Mangga",
    aliases: ["mangga", "mango", "arumanis", "gedong", "gedong gincu", "manalagi", "simanalagi", "harum manis"],
    category: "Buah Tropis",
    icon: "🥭",
    recommendedStorage: "Suhu ruang sampai wangi, lalu simpan di kulkas",
    ethylene: "Sensitif Etilen saat mentah, Penghasil Etilen saat matang",
    shelfLife: {
      room_temp: {
        unripe: 6, // 4-6 hari di suhu ruang sampai matang
        ripe: 3,   // 2-3 hari setelah matang
        cut: 1,
      },
      chiller: {
        unripe: 4,
        ripe: 7,   // mangga matang tahan 5-7 hari di kulkas
        cut: 3,    // potongan mangga di wadah kedap
      },
      freezer: {
        unripe: 60,
        ripe: 180, // potongan mangga beku tahan hingga 6 bulan
        cut: 180,
      },
    },
    storageTips: [
      "Mangga yang masih keras simpan di suhu ruang dengan posisi tangkai di bawah.",
      "Setelah aroma mangga tercium wangi manis dan tekstur agak membal lembut, masukkan kulkas agar kesegarannya terkunci.",
      "Potongan mangga simpan dalam wadah kedap udara (tupperware) di chiller.",
    ],
    spoilageSigns: [
      "Bintik hitam besar cekung yang berair dan mengeluarkan cairan lengket berbusa.",
      "Aroma fermentasi mirip cuka atau tape asam menyengat.",
      "Daging buah menjadi bubur lembek dan berurat gelap.",
    ],
  },
  {
    id: "semangka",
    name: "Semangka",
    aliases: ["semangka", "watermelon", "semangka merah", "semangka kuning", "semangka inul", "semangka non biji"],
    category: "Buah Tropis",
    icon: "🍉",
    recommendedStorage: "Suhu ruang (utuh), Kulkas (setelah dipotong)",
    ethylene: "Sangat Sensitif Etilen (Jauhkan dari apel & pisang)",
    shelfLife: {
      room_temp: {
        unripe: 14,
        ripe: 10,  // semangka utuh tahan 7-10 hari di suhu ruang
        cut: 1,    // semangka potong jangan dibiarkan di suhu ruang > 4 jam
      },
      chiller: {
        unripe: 14,
        ripe: 14,  // utuh di kulkas tahan 2 minggu
        cut: 4,    // potong dibungkus rapat tahan 3-4 hari
      },
      freezer: {
        unripe: 90,
        ripe: 180, // potongan beku untuk jus
        cut: 180,
      },
    },
    storageTips: [
      "Semangka utuh paling baik disimpan di tempat sejuk dan kering pada suhu ruang.",
      "Begitu dibelah, segera bungkus permukaan terbuka dengan cling wrap atau potong dadu masukkan wadah kedap udara lalu simpan di chiller.",
      "Semangka mudah menyerap aroma makanan lain di kulkas (seperti durian/bawang), pastikan wadah tertutup rapat.",
    ],
    spoilageSigns: [
      "Daging buah berlendir licin, mengeluarkan buih, atau warna memudar pucat kusam.",
      "Bau asam kecut atau bau tape busuk.",
      "Daging buah terasa berpasir kering keropos dan hambar.",
    ],
  },
  {
    id: "melon",
    name: "Melon",
    aliases: ["melon", "honeydew", "cantaloupe", "rockmelon", "melon hijau", "melon oranye"],
    category: "Buah Tropis",
    icon: "🍈",
    recommendedStorage: "Suhu ruang (utuh), Kulkas Chiller (setelah dipotong)",
    ethylene: "Sensitif Etilen (Cantaloupe menghasilkan etilen tinggi)",
    shelfLife: {
      room_temp: {
        unripe: 10,
        ripe: 5,
        cut: 1,
      },
      chiller: {
        unripe: 14,
        ripe: 10,
        cut: 4,    // potong di kulkas tahan 3-4 hari
      },
      freezer: {
        unripe: 90,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Melon utuh simpan di meja dapur sampai tercium aroma manis dari ujung batangnya.",
      "Setelah dipotong, buang biji dan seratnya, lalu potong-potong dan simpan dalam wadah kedap di kulkas.",
    ],
    spoilageSigns: [
      "Daging buah berlendir basah licin dan berbau asam.",
      "Bagian kulit luar timbul bercak jamur basah melengkung ke dalam.",
    ],
  },
  {
    id: "pepaya",
    name: "Pepaya",
    aliases: ["pepaya", "papaya", "california", "pepaya bangkok"],
    category: "Buah Tropis",
    icon: "🥭",
    recommendedStorage: "Suhu ruang sampai menguning, kulkas chiller bila sudah matang",
    ethylene: "Penghasil Etilen Sedang",
    shelfLife: {
      room_temp: {
        unripe: 7, // pepaya semburat hijau butuh 4-7 hari
        ripe: 3,   // 2-3 hari
        cut: 1,
      },
      chiller: {
        unripe: 5,
        ripe: 6,   // utuh matang di kulkas tahan 5-7 hari
        cut: 3,    // potongan dalam wadah kedap
      },
      freezer: {
        unripe: 60,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Jika pepaya masih banyak warna hijau, biarkan di suhu ruang sampai 80% menguning.",
      "Kupas dan buang bijinya, simpan potongan dalam wadah rapat di kulkas chiller.",
      "Jangan bekukan pepaya utuh; hanya bekukan potongan dadu untuk jus.",
    ],
    spoilageSigns: [
      "Kulit luar benyek hitam berair dan timbul bintik putih berjamur.",
      "Daging buah berlendir dan bau asam menyengat.",
    ],
  },
  {
    id: "stroberi",
    name: "Stroberi & Berries",
    aliases: ["stroberi", "strawberry", "blueberry", "raspberry", "blackberry", "berry"],
    category: "Buah Berry",
    icon: "🍓",
    recommendedStorage: "Kulkas (Chiller) dengan alas tisu kering",
    ethylene: "Sensitif Kelembapan Tinggi (Mudah Jamuran)",
    shelfLife: {
      room_temp: {
        unripe: 2,
        ripe: 1,   // di suhu ruang tropis cepat sekali berjamur (1 hari)
        cut: 1,
      },
      chiller: {
        unripe: 5,
        ripe: 5,   // tahan 3-5 hari di chiller
        cut: 2,
      },
      freezer: {
        unripe: 180,
        ripe: 365, // beku tahan 6-12 bulan
        cut: 180,
      },
    },
    storageTips: [
      "JANGAN PERNAH MENCUCI stroberi sebelum disimpan! Air memicu jamur spora dalam hitungan jam.",
      "Alasi wadah penyimpanan dengan selembar tisu dapur (paper towel) untuk menyerap uap lembap berlebih.",
      "Buang segera stroberi yang berjamur agar tidak menulari buah lainnya.",
      "Cuci bersih dengan air mengalir hanya beberapa saat sebelum dimakan.",
    ],
    spoilageSigns: [
      "Timbul serbuk atau bulu jamur putih / abu-abu (Botrytis cinerea).",
      "Tekstur lembek basah dan mengeluarkan cairan keruh kental.",
      "Warna pudar kecokelatan kusam.",
    ],
  },
  {
    id: "anggur",
    name: "Anggur",
    aliases: ["anggur", "grapes", "grape", "anggur merah", "anggur hijau", "anggur hitam", "shine muscat", "autumn crisp"],
    category: "Buah Subtropis",
    icon: "🍇",
    recommendedStorage: "Kulkas (Chiller) dalam wadah aslinya yang berlubang",
    ethylene: "Tidak Terlalu Sensitif Etilen",
    shelfLife: {
      room_temp: {
        unripe: 5,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 14,
        ripe: 12,  // 1-2 minggu di kulkas chiller
        cut: 3,
      },
      freezer: {
        unripe: 180,
        ripe: 240, // anggur beku sangat nikmat sebagai camilan es
        cut: 180,
      },
    },
    storageTips: [
      "Jangan petik buah dari batangnya sebelum disimpan; biarkan tetap menempel pada tangkainya.",
      "Simpan dalam keadaan kering di kantong atau kemasan aslinya yang memiliki ventilasi udara.",
      "Cuci bersih sesaat sebelum dikonsumsi.",
    ],
    spoilageSigns: [
      "Buah terlepas sendiri dari tangkai dan pangkalnya berair kecokelatan.",
      "Tekstur lembek keriput dan berbau cuka / ragi fermentasi.",
      "Lapisan jamur putih keabuan pada sela-sela dompolan.",
    ],
  },
  {
    id: "tomat",
    name: "Tomat & Tomat Ceri",
    aliases: ["tomat", "tomato", "tomat ceri", "cherry tomato", "tomat buah", "tomat sayur"],
    category: "Sayur Buah",
    icon: "🍅",
    recommendedStorage: "Suhu ruang posisi tangkai di bawah (untuk rasa terbaik)",
    ethylene: "Penghasil Etilen Sedang",
    shelfLife: {
      room_temp: {
        unripe: 10, // tomat hijau/oranye tahan 7-10 hari
        ripe: 5,    // 4-5 hari di suhu ruang
        cut: 1,
      },
      chiller: {
        unripe: 5,  // suhu dingin merusak tekstur & rasa tomat mentah
        ripe: 10,   // tomat sangat matang tahan 7-10 hari di chiller
        cut: 3,
      },
      freezer: {
        unripe: 90,
        ripe: 180,  // bekukan untuk bahan saus / sambal / tumisan
        cut: 180,
      },
    },
    storageTips: [
      "Simpan tomat segar di suhu ruang dengan posisi bekas tangkai menghadap ke bawah agar udara tidak masuk dan tidak cepat keriput.",
      "Hindari sinar matahari langsung.",
      "Hanya masukkan kulkas jika tomat sudah merah tua matang sempurna dan belum akan diolah dalam 2 hari.",
    ],
    spoilageSigns: [
      "Kulit melunak becek dan bocor cairan asam saat dipegang.",
      "Muncul bercak hitam cekung atau jamur putih di area dekat tangkai.",
      "Aroma masam busuk.",
    ],
  },
  {
    id: "nanas",
    name: "Nanas",
    aliases: ["nanas", "pineapple", "nanas madu", "nanas subang", "nanas honi"],
    category: "Buah Tropis",
    icon: "🍍",
    recommendedStorage: "Suhu ruang (utuh 2-3 hari), Kulkas Chiller (potongan)",
    ethylene: "Tidak Menghasilkan Etilen Pasca Panen (Tidak akan bertambah manis)",
    shelfLife: {
      room_temp: {
        unripe: 4,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 7,
        ripe: 7,   // nanas utuh di kulkas tahan 5-7 hari
        cut: 5,    // nanas potong di kulkas tahan 4-5 hari
      },
      freezer: {
        unripe: 180,
        ripe: 365, // potongan nanas beku sangat awet
        cut: 365,
      },
    },
    storageTips: [
      "Nanas tidak mengalami pematangan lebih lanjut setelah dipetik. Segera olah atau simpan di tempat dingin.",
      "Untuk nanas utuh, simpan terbalik (daun mahkota di bawah) selama 1 hari agar gula yang terkumpul di dasar menyebar ke seluruh buah.",
      "Setelah dikupas, simpan di kotak kedap bersama sedikit air garam atau air matang.",
    ],
    spoilageSigns: [
      "Dasar buah basah berlendir dan berbau alkohol / cuka menyengat.",
      "Daun mahkota cokelat mengering rontok dan kulit luar cokelat kehitaman kusam.",
      "Daging nanas berwarna cokelat gelap translusen dan terasa pahit menyengat di lidah.",
    ],
  },
  {
    id: "pir",
    name: "Pir (Pear)",
    aliases: ["pir", "pear", "pir xiang lie", "pir century", "pir golden", "pir packham"],
    category: "Buah Subtropis",
    icon: "🍐",
    recommendedStorage: "Suhu ruang sampai empuk di leher buah, lalu Kulkas Chiller",
    ethylene: "Penghasil Etilen Tinggi",
    shelfLife: {
      room_temp: {
        unripe: 7,
        ripe: 4,
        cut: 1,
      },
      chiller: {
        unripe: 21,
        ripe: 14,  // 1-2 minggu di chiller
        cut: 3,
      },
      freezer: {
        unripe: 180,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Cek kematangan pir dengan menekan lembut area leher dekat tangkai (bukan badannya). Jika empuk, pir sudah matang.",
      "Setelah matang, simpan di kulkas untuk menjaga tekstur renyah dan kadar airnya.",
    ],
    spoilageSigns: [
      "Daging buah kecokelatan lembek dari dalam (core browning).",
      "Kulit luar hitam memar becek.",
    ],
  },
  {
    id: "naga",
    name: "Buah Naga",
    aliases: ["buah naga", "naga", "dragon fruit", "pitaya", "naga merah", "naga putih"],
    category: "Buah Tropis",
    icon: "🐲",
    recommendedStorage: "Kulkas (Chiller) dalam kantong plastik berlubang",
    ethylene: "Sensitif Rendah",
    shelfLife: {
      room_temp: {
        unripe: 5,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 14,
        ripe: 10,  // buah naga utuh tahan 7-10 hari di chiller
        cut: 3,    // potongan di wadah kedap
      },
      freezer: {
        unripe: 90,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Jangan memotong buah naga jika belum akan dimakan.",
      "Simpan buah utuh di kulkas; kulit tebalnya melindungi daging buah dari dehidrasi.",
    ],
    spoilageSigns: [
      "Sisik buah mengering hitam kecokelatan dan kulit terasa sangat empuk berair.",
      "Daging buah berubah warna kecokelatan dan berbau apek asam.",
    ],
  },
  {
    id: "salak",
    name: "Salak",
    aliases: ["salak", "snake fruit", "salak pondoh", "salak bali"],
    category: "Buah Tropis",
    icon: "🌰",
    recommendedStorage: "Suhu ruang di wadah berventilasi (jangan simpan di kantong plastik tertutup)",
    ethylene: "Sensitif Sedang",
    shelfLife: {
      room_temp: {
        unripe: 7,
        ripe: 5,
        cut: 1,
      },
      chiller: {
        unripe: 10,
        ripe: 10,  // tahan hingga 10 hari di laci kulkas
        cut: 2,
      },
      freezer: {
        unripe: 60,
        ripe: 90,
        cut: 90,
      },
    },
    storageTips: [
      "Salak butuh sirkulasi udara baik; letakkan di keranjang buah terbuka.",
      "Jika disimpan di kantong plastik rapat, uap air akan terperangkap dan menyebabkan salak cepat berjamur dan busuk.",
    ],
    spoilageSigns: [
      "Ujung buah lembek berair dan mengeluarkan bau cuka pekat.",
      "Daging buah berubah menjadi kuning tua/cokelat berlendir.",
    ],
  },
  {
    id: "kelengkeng_rambutan",
    name: "Kelengkeng & Rambutan",
    aliases: ["kelengkeng", "lengkeng", "longan", "rambutan", "rambutan rapiah", "rambutan binjai", "lychee", "leci"],
    category: "Buah Tropis",
    icon: "🍒",
    recommendedStorage: "Kulkas (Chiller) dibungkus kantong kertas / plastik berlubang",
    ethylene: "Sensitif Rendah",
    shelfLife: {
      room_temp: {
        unripe: 4,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 10,
        ripe: 8,   // 7-10 hari di chiller
        cut: 2,
      },
      freezer: {
        unripe: 90,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Biarkan buah tetap menempel pada tangkainya.",
      "Di suhu ruang tropis, kulit rambutan cepat menghitam dalam 2-3 hari; simpan di kulkas untuk mempertahankan kesegaran daging buahnya.",
    ],
    spoilageSigns: [
      "Kulit luar basah lembek berbau asam busuk.",
      "Daging buah menjadi keruh kecokelatan dan berlendir.",
    ],
  },
  {
    id: "jambu",
    name: "Jambu (Biji & Air)",
    aliases: ["jambu", "jambu biji", "guava", "jambu kristal", "jambu air", "jambu citra", "jambu mete"],
    category: "Buah Tropis",
    icon: "🍏",
    recommendedStorage: "Kulkas (Chiller)",
    ethylene: "Jambu Biji penghasil etilen tinggi; Jambu Air sensitif benturan",
    shelfLife: {
      room_temp: {
        unripe: 5,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 10,
        ripe: 7,   // 5-7 hari di kulkas
        cut: 2,
      },
      freezer: {
        unripe: 60,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "Untuk jambu kristal, simpan utuh dalam plastik rapat di kulkas agar tetap renyah dan tidak kehilangan kelembapan.",
      "Untuk jambu air, cuci dan keringkan lembut sebelum masuk kulkas, jangan ditumpuk berat.",
    ],
    spoilageSigns: [
      "Bercak cokelat memar meluas lembek.",
      "Daging buah berserat hitam dan berbau apek asam.",
    ],
  },
  {
    id: "kiwi",
    name: "Kiwi",
    aliases: ["kiwi", "kiwifruit", "kiwi hijau", "kiwi gold", "sun gold"],
    category: "Buah Subtropis",
    icon: "🥝",
    recommendedStorage: "Suhu ruang sampai matang empuk, lalu Kulkas Chiller",
    ethylene: "Sangat Sensitif Etilen",
    shelfLife: {
      room_temp: {
        unripe: 7,
        ripe: 4,
        cut: 1,
      },
      chiller: {
        unripe: 30,
        ripe: 14,  // kiwi matang bisa awet 2 minggu di kulkas
        cut: 3,
      },
      freezer: {
        unripe: 180,
        ripe: 240,
        cut: 180,
      },
    },
    storageTips: [
      "Kiwi yang masih keras bisa disimpan lama di kulkas hingga 3-4 minggu.",
      "Keluarkan ke suhu ruang 2-3 hari saat ingin dimatangkan.",
    ],
    spoilageSigns: [
      "Kulit mengerut keriput sangat lembek saat dipegang.",
      "Daging buah kecokelatan dan berbau fermentasi asam.",
    ],
  },
  {
    id: "belimbing",
    name: "Belimbing",
    aliases: ["belimbing", "starfruit", "star fruit", "belimbing manis", "belimbing dewa"],
    category: "Buah Tropis",
    icon: "⭐",
    recommendedStorage: "Suhu ruang sampai kuning, lalu Kulkas",
    ethylene: "Sensitif Sedang",
    shelfLife: {
      room_temp: {
        unripe: 5,
        ripe: 3,
        cut: 1,
      },
      chiller: {
        unripe: 10,
        ripe: 7,
        cut: 2,
      },
      freezer: {
        unripe: 60,
        ripe: 120,
        cut: 120,
      },
    },
    storageTips: [
      "Belimbing dengan tepi rusuk hijau simpan di suhu ruang sampai seluruhnya kuning keemasan.",
      "Setelah matang, simpan di kulkas tanpa ditumpuk agar tepi bintangnya tidak memar.",
    ],
    spoilageSigns: [
      "Tepi rusuk buah menghitam lembek dan berair.",
      "Bercak cokelat basah merata pada kulit.",
    ],
  },
  {
    id: "durian",
    name: "Durian",
    aliases: ["durian", "duren", "montong", "musang king", "bawor", "petruk", "black thorn"],
    category: "Buah Tropis",
    icon: "🍈",
    recommendedStorage: "Wadah kedap udara khusus di kulkas / freezer",
    ethylene: "Aroma Kuat & Etilen Tinggi",
    shelfLife: {
      room_temp: {
        unripe: 4,
        ripe: 2,   // durian merekah di suhu ruang cepat asam (1-2 hari)
        cut: 1,
      },
      chiller: {
        unripe: 4,
        ripe: 5,   // dalam wadah kedap ganda tahan 4-5 hari
        cut: 4,
      },
      freezer: {
        unripe: 90,
        ripe: 180, // durian beku bisa bertahan 3-6 bulan
        cut: 180,
      },
    },
    storageTips: [
      "Keluarkan daging durian dari kulit berduri dan simpan dalam wadah kedap udara rapat (lock&lock).",
      "Bungkus wadah dengan plastik tambahan jika disimpan di kulkas biasa agar aroma tajamnya tidak mengontaminasi bahan makanan lain.",
      "Untuk penyimpanan jangka panjang, durian sangat ideal dibekukan di freezer.",
    ],
    spoilageSigns: [
      "Rasa asam menyengat seperti cuka basi (bukan pahit alkohol manis khas durian matang).",
      "Daging durian menjadi sangat berair, berlendir licin, dan warna menggelap kusam.",
    ],
  },
  {
    id: "cabai",
    name: "Cabai & Bumbu Segar",
    aliases: ["cabai", "cabe", "cabai rawit", "cabai merah", "cabai keriting", "lombok", "cabe ijo"],
    category: "Sayur & Bumbu Segar",
    icon: "🌶️",
    recommendedStorage: "Kulkas (Chiller) dengan wadah dialasi tisu dan tangkai dibuang",
    ethylene: "Sensitif Kelembapan Berlebih",
    shelfLife: {
      room_temp: {
        unripe: 6,
        ripe: 4,
        cut: 2,
      },
      chiller: {
        unripe: 21,
        ripe: 18,  // tahan 2-3 minggu jika tangkai dipetik & beralas tisu
        cut: 5,
      },
      freezer: {
        unripe: 90,
        ripe: 180,
        cut: 180,
      },
    },
    storageTips: [
      "PETIK TANGKAI CABAI sebelum disimpan! Tangkai yang masih menempel memicu pembusukan lebih cepat.",
      "JANGAN DICUCI sebelum masuk kulkas. Lap bersih dengan tisu kering bila kotor.",
      "Simpan dalam kotak kedap udara yang dialasi tisu dapur di dasar dan atasnya.",
      "Tambahkan 1 siung bawang putih kupas di dalam wadah cabai sebagai antibakteri alami.",
    ],
    spoilageSigns: [
      "Kulit cabai lembek keriput basah berlendir cokelat.",
      "Timbul bercak kehitaman atau jamur putih di bagian dalam biji.",
    ],
  },
  {
    id: "wortel",
    name: "Wortel",
    aliases: ["wortel", "carrot", "baby carrot", "wortel brastagi", "wortel impor"],
    category: "Sayuran Segar",
    icon: "🥕",
    recommendedStorage: "Kulkas (Chiller) dalam wadah atau kantong berlubang",
    ethylene: "Sangat Sensitif Etilen (Menjadi Pahit)",
    shelfLife: {
      room_temp: {
        unripe: 7,
        ripe: 5,
        cut: 1,
      },
      chiller: {
        unripe: 30,
        ripe: 25,  // tahan 3-4 minggu di chiller
        cut: 6,    // rendam air matang di kulkas untuk potongan wortel
      },
      freezer: {
        unripe: 180,
        ripe: 240, // rebus sebentar (blanch) lalu bekukan
        cut: 240,
      },
    },
    storageTips: [
      "Potong pangkal daun hijau pada wortel karena daun terus menyerap air dari umbi wortel.",
      "Jauhkan wortel dari apel dan pisang agar wortel tidak berubah rasa menjadi pahit.",
      "Untuk wortel yang sudah dikupas/dipotong, simpan dalam wadah terendam air matang dingin di kulkas (ganti air tiap 2 hari).",
    ],
    spoilageSigns: [
      "Tekstur menjadi lemas membengkok, lembek, dan berlendir hitam.",
      "Muncul bercak hitam lebam di sepanjang umbi.",
    ],
  },
  {
    id: "timun",
    name: "Mentimun",
    aliases: ["timun", "mentimun", "cucumber", "kyuri", "timun jepang"],
    category: "Sayur Buah",
    icon: "🥒",
    recommendedStorage: "Kulkas Chiller bagian depan / rak pintu (sensitif suhu terlalu dingin)",
    ethylene: "Sensitif Etilen & Sensitif Chilling Injury",
    shelfLife: {
      room_temp: {
        unripe: 7,
        ripe: 5,
        cut: 1,
      },
      chiller: {
        unripe: 10,
        ripe: 8,   // 7-10 hari di area tidak terlalu beku
        cut: 3,
      },
      freezer: {
        unripe: 30,
        ripe: 60,
        cut: 60,
      },
    },
    storageTips: [
      "Bungkus masing-masing timun dengan selembar tisu dapur lalu masukkan kantong plastik.",
      "Letakkan di rak pintu kulkas atau bagian yang suhunya tidak terlalu dingin (hindari bagian belakang chiller agar tidak watery).",
    ],
    spoilageSigns: [
      "Ujung timun lembek berlendir transparan.",
      "Kulit mengerut keriput kuning dan bagian dalam menjadi bubur berair.",
    ],
  },
];

/**
 * Mencari kecocokan buah berdasarkan string nama barang
 */
export function detectFruit(itemName = "") {
  if (!itemName || typeof itemName !== "string") return null;

  const cleanName = itemName.toLowerCase().trim();

  // Cari exact word atau substring match dari alias buah
  for (const fruit of FRUIT_EXPIRY_DATABASE) {
    for (const alias of fruit.aliases) {
      // Cek apakah alias ada di dalam nama barang (sebagai kata terpisah atau terangkai jelas)
      const regex = new RegExp(`(^|\\b|\\s)${alias}(\\b|\\s|$)`, "i");
      if (regex.test(cleanName) || cleanName.includes(alias)) {
        return fruit;
      }
    }
  }

  return null;
}

/**
 * Normalisasi tipe zona penyimpanan ke key shelf life
 * @param {string} storageName
 * @returns {'room_temp' | 'chiller' | 'freezer'}
 */
export function normalizeStorageZone(storageName = "") {
  const s = (storageName || "").toLowerCase();
  if (s.includes("freezer") || s.includes("beku")) {
    return "freezer";
  }
  if (s.includes("kulkas") || s.includes("chiller") || s.includes("lemari es") || s.includes("crisper")) {
    return "chiller";
  }
  return "room_temp";
}

/**
 * Menghitung tanggal kedaluwarsa estimasi untuk buah / bahan segar
 * @param {Object} options
 * @param {string} options.fruitId - ID buah dalam database
 * @param {'room_temp' | 'chiller' | 'freezer'} options.storageType - Tempat penyimpanan
 * @param {'unripe' | 'ripe' | 'cut'} options.condition - Kondisi kematangan/bentuk
 * @param {string|Date} [options.baseDate] - Tanggal beli/pencatatan (default: hari ini)
 */
export function calculateFruitExpiry({ fruitId, storageType = "chiller", condition = "ripe", baseDate = new Date() }) {
  const fruit = FRUIT_EXPIRY_DATABASE.find((f) => f.id === fruitId);
  if (!fruit) return null;

  const storageKey = ["room_temp", "chiller", "freezer"].includes(storageType) ? storageType : "chiller";
  const condKey = ["unripe", "ripe", "cut"].includes(condition) ? condition : "ripe";

  const storageData = fruit.shelfLife[storageKey] || fruit.shelfLife.chiller;
  let days = storageData[condKey];

  if (typeof days !== "number" || days <= 0) {
    days = storageData.ripe || 5;
  }

  const startDate = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate || Date.now());
  const expiryDateObj = new Date(startDate);
  expiryDateObj.setDate(expiryDateObj.getDate() + days);

  const expiryDateStr = expiryDateObj.toISOString().split("T")[0];

  return {
    fruit,
    storageType,
    condition,
    shelfLifeDays: days,
    expiryDate: expiryDateStr,
    expiryDateFormatted: new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(expiryDateObj),
    recommendedStorage: fruit.recommendedStorage,
    storageTips: fruit.storageTips,
    spoilageSigns: fruit.spoilageSigns,
    ethylene: fruit.ethylene,
  };
}

/**
 * Mengambil semua daftar buah untuk browsing
 */
export function getAllFruits() {
  return FRUIT_EXPIRY_DATABASE;
}
