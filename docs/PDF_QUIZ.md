# 教科書PDF版クイズ

アップロードされたCH1〜CH5のPDFに基づく学習用問題を150問（各章30問）新規作成しました。以前の87問のDiscussion教材とは別の問題集です。

## 内容と出題

- 問題文・4つの選択肢・正答は英語。採点後の解説は日本語。正答は1つ。
- 各章のカードから10問を開始できます。設定では5・10・20・50・全問を選べます。
- 全章50問は各章から10問ずつ。重複なく出題し、順番と正答位置をシャッフルします。
- 章別で指定数が30問を超える場合は、その章の全30問を出題します。
- CH4の信頼性とCH5の意思決定理論の補足を含みます。
- 計算問題の数値は練習用に設定し、24問を別途再計算しています。
- 回答後と結果一覧に、PDF先頭を1ページ目とする参照ページを表示します。
- 不正解問題だけの復習、今回の誤答だけの再挑戦、同じ問題セットの再挑戦ができます。
- 学習記録は `om-notes-pdf-progress-v1` に保存します。旧Discussion教材の `om-notes-progress-v1` は保持します。

## 出典

PDF本文を読み取り、各問の参照ページに出典キーワードがあることと、原本PDFのSHA-256を照合しました。PDFは作業環境内でのみ参照し、原本ファイル自体を公開サイトやGitHubに追加していません。問題は教材から新規作成しており、教科書の原文問題の転載や出版社公式の問題・解答ではありません。

| 教材 | PDFページ数 | SHA-256 |
| --- | ---: | --- |
| 作業管理　CH1.pdf | 40 | `19c6b3d44cd5716636c86b3dc5f8d746a4245626c2ca4a2c7fdec8437c5c82f7` |
| 作業管理　CH2.pdf | 34 | `59ce13273ad7cc9622ece4bc3b4a0b9396c61365af7194e664f474e5d5edb7dd` |
| 作業管理　CH3.pdf | 65 | `885bf8b4d28d8780d2c2b3a2f7f67b6ee411938c236ab4fca5a7416dabb0741c` |
| 作業管理　CH4.pdf | 53 | `116507bb02820ef48d9ca0c579b1b24d79a2cedc70d752fb779865379e5c8c7d` |
| 作業管理　CH5.pdf | 55 | `c0005bb13d9e9280365d48eb9669e0c6ce37ed691d5629f70676ca123734321a` |

## MSEの定義に関する注意

CH3 PDFの式（3-16）は二乗誤差の合計を n−1 で割っています。PDF版の該当問題はこの定義を明記して出題します。一般に n で割る定義もあるため、定義を混ぜず、以前のDiscussion教材データも書き換えていません。

## 検証コマンド

```sh
npm run validate:pdf
# 元PDFが手元にある場合（要pdftotext）:
npm run validate:pdf -- --pdf-dir /path/to/uploaded/pdfs
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm test
```

`validate:pdf` は問題数・ID・4択・英語テキスト・日本語解説・ページ範囲・24計算問題を検査します。`--pdf-dir` を指定するとPDFハッシュ、247ページ、150件の参照ページ内キーワードも検査します。

## ファイル

- `src/PdfQuiz.tsx`: PDFクイズの画面・出題・採点・復習・保存
- `src/data/pdf-quiz.json`: 新規150問と日本語解説・参照ページ
- `src/data/pdf-sources.json`: PDF名・ページ数・原本ハッシュ
- `scripts/validate_pdf_quiz.py`: データ・数式・PDF参照の検査
- `tests/pdf-quiz.spec.ts`: PDF版のブラウザ操作テスト
