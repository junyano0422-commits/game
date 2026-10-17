# 追加登録なしで公開する

既存のGitHubアカウントと公開リポジトリを使い、GitHub Pagesで新作を公開できます。Cloudflare等への追加登録や、別のAPIキーの発行は不要です。

公開対象は検証済みの単一HTML版「ラスト・エレベーター」。予定URLは `https://junyano0422-commits.github.io/game/` です。この文書やワークフローの保存だけでは公開されません。公開時は誰でもアクセスできるゲームになります。個人のセーブデータや秘密情報は含みません。

## 今回の公開方法：専用ブランチ

ユーザーから公開承認を受けたため、検証済みの単一HTMLを `gh-pages` ブランチの `index.html` として配置します。アプリのソースブランチや既存サイトのファイルを置き換える必要はありません。

GitHubの **Settings → Pages → Build and deployment** で、Sourceを **Deploy from a branch**、Branchを **gh-pages**、フォルダーを **/(root)** にして **Save** します。これが初回に必要な所有者の操作です。その後の公開処理はGitHub Pagesが行います。

公開対象は `https://junyano0422-commits.github.io/game/`。ブランチを配置しただけでは、サイトの有効化や公開成功を意味しません。この環境からはGitHub設定APIと公開URLへの接続がネットワークで拒否されています。新しいトークンをチャットで求めたり、接続制限を迂回したりせず、所有者による設定操作を待ちます。

`gh-pages` の更新は本番への更新になるため、以後も明示的な公開承認を得てから行います。個人のセーブや秘密情報を公開ブランチに含めません。

## 代替：手動ワークフローで公開する場合

1. 確認した変更と `.github/workflows/deploy-pages.yml` を既定ブランチに取り込みます。`workflow_dispatch` は既定ブランチにワークフローが存在する必要があります。
2. 既存のGitHubアカウントでリポジトリの **Settings → Pages → Build and deployment → Source → GitHub Actions** を一度選びます。既存のPagesサイトがある場合は置き換えの影響を先に確認します。
3. Actionsの **Publish Last Elevator (manual approval)** を開き、確認したブランチまたはコミットを指定して **Run workflow** を実行します。この操作が本番公開の開始です。
4. 型検査・テスト・ビルドが成功すると、検証した単一HTMLだけがPagesに公開されます。公開後に実URLで開始・保存再開・共有URLを確認します。

新しいPushやPull Requestでは公開しません。必要ならGitHubの `github-pages` environmentに承認者を指定して、手動実行に加え公開直前のレビューも必須にできます。

この環境ではGitHubへのGit操作はできますが、GitHub APIへのアクセスが拒否されています。Pagesの有効化や実行ボタンの操作をこちらから完了できない場合は、所有者が上記画面で操作する必要があります。アカウントのパスワードをチャットに送らないでください。
