# İkinci El Lüks Yedek Parça Kataloğu — Faz 1

Bu depo fiziksel parçaların dosya-tabanlı katalogudur. Her fiziksel ürün, OEM numarası aynı olsa bile, kendi klasöründe tutulur. Merkezi Excel veya liste elle güncellenmez; envanter ve sonraki otomasyonlar `parca.md` kartlarından türetilir.

## Hızlı kullanım

1. Doğru `catalog/<kategori>/` klasöründe `OEMNO-01` biçiminde bir ürün klasörü açın. Aynı OEM'in sonraki fiziksel ürünü `OEMNO-02` olur.
2. `templates/parca.md` dosyasını ürün klasörüne `parca.md` adıyla kopyalayın ve YAML alanlarını doldurun.
3. En az etiket/OEM fotoğrafı ekleyin. Adlar `OEMNO-01-etiket.jpg`, `OEMNO-01-on.jpg`, `OEMNO-01-hasar.jpg` gibi olmalıdır.
4. Marka, model, uyumluluk veya OEM kesin değilse tahmin yazmayın: ilgili alanları boş bırakın, `dogrulama_durumu: bekliyor` (OEM de okunamıyorsa `inceleniyor`) kullanın.
5. Kontrolü çalıştırın: `node scripts/validate-catalog.mjs`.
6. Merkezi indeksi elle değiştirmeden üretin: `node scripts/build-index.mjs`. Bu komut önce kartları denetler, sonra `catalog/index.json` ve okunabilir `catalog/index.md` dosyalarını yeniler.

## Kategoriler

Kategori adlarını siz belirlersiniz; `catalog/` altında küçük harf, rakam ve tireyle klasör açın (ör. `motor-parcalari`). Karttaki `kategori` alanı klasör adıyla birebir aynı olmalıdır. Başlangıç örnekleri yalnız önerilen gruplamayı gösterir.

## Durumlar

| Değer | Anlamı |
| --- | --- |
| `dogrulandi` | OEM ve uyumluluk bilgisi güvenilir kaynaktan doğrulandı. |
| `bekliyor` | Parça kaydedildi, marka/model ya da uyumluluk henüz kesin değil. |
| `inceleniyor` | OEM/etiket eksik veya belirsiz; ilan/uyumluluk otomasyonuna girmemeli. |

Katalog, yalnız Mercedes, BMW, Audi, Volvo, Land Rover/Range Rover ve Volkswagen ile başlar. Bu bir kabul listesi değil, Faz 1 çalışma sınırıdır.

## Sonraki faz sınırı

Bu depo muhasebe, Netsis/Logo, n8n, Sahibinden veya fiyat verisine doğrudan yazmaz. Bunlar yalnız kartlardan üretilen onaylı dışa aktarım üzerinden ayrıca bağlanacaktır.
