/**
 * Kamp Görevleri özelliklerinin açıldığı geçilen bölüm sayısı (apps/web/src/ftue/features.ts bu sayıları kullanır; sunucu da
 * aynısını uygular). Ayrı dosyada: arayüzün ilk parçası bunu okur ama vaka/timpanogram verisini (kamp-gorev*.ts) yüklemez.
 */
export const KG_ACILIS = { gorev: 4, oyun: 6, vaka: 7 } as const;
export type KgOzellik = keyof typeof KG_ACILIS;
