/**
 * Helper untuk parsing dan formatting informasi kemasan bertingkat (Kardus, Pack, Dus, Bungkus @ X pcs)
 */
export function parsePackageInfo(name = "") {
  if (!name || typeof name !== "string") {
    return {
      hasPackage: false,
      baseName: "",
      packageQty: 1,
      packageUnit: "Pcs",
      pcsPerPackage: 1,
      totalPcs: 1,
      formatName: () => "",
    };
  }

  // Pola standar: "Nama Barang (1 Kardus @ 12 pcs)" atau "Bahan (2 Pack @ 40 pcs)"
  const regex = /\((\d+(?:\.\d+)?)\s+([a-zA-Z\/\s]+)\s*@\s*(\d+(?:\.\d+)?)\s*pcs\)/i;
  const match = name.match(regex);

  if (match) {
    const pkgQty = parseFloat(match[1]) || 1;
    const pkgUnit = match[2].trim();
    const pcsPerPkg = parseFloat(match[3]) || 1;
    const baseName = name.replace(regex, "").trim();
    const totalPcs = Math.round(pkgQty * pcsPerPkg * 100) / 100;

    return {
      hasPackage: true,
      baseName: baseName || name,
      packageQty: pkgQty,
      packageUnit: pkgUnit,
      pcsPerPackage: pcsPerPkg,
      totalPcs: totalPcs > 0 ? totalPcs : 1,
      formatName: (newQty) => `${baseName || name} (${newQty} ${pkgUnit} @ ${pcsPerPkg} pcs)`,
    };
  }

  return {
    hasPackage: false,
    baseName: name,
    packageQty: 1,
    packageUnit: "Pcs",
    pcsPerPackage: 1,
    totalPcs: 1,
    formatName: () => name,
  };
}
