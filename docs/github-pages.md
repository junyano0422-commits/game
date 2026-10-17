# 追加登録なしで公開する

既存のGitHubアカウントと公開リポジトリを使い、GitHub Pagesで新作を公開できます。Cloudflare等への追加登録や、別のAPIキーの発行は不要です。

公開対象は検証済みの単一HTML版「ラスト・エレベーター」。予定URLは `https://junyano0422-commits.github.io/game/` です。この文書やワークフローの保存だけでは公開されません。公開時は誰でもアクセスできるゲームになります。個人のセーブデータや秘密情報は含みません。

## 人間の承認後に行うこと

1. 確認した変更と `.github/workflows/deploy-pages.yml` を既定ブランチに取り込みます。`workflow_dispatch` は既定ブランチにワークフローが存在する必要があります。
2. 既存のGitHubアカウントでリポジトリの **Settings → Pages → Build and deployment → Source → GitHub Actions** を一度選びます。既存のPagesサイトがある場合は置き換えの影響を先に確認します。
3. Actionsの **Publish Last Elevator (manual approval)** を開き、確認したブランチまたはコミットを指定して **Run workflow** を実行します。この操作が本番公開の開始です。
4. 型検査・テスト・ビルドが成功すると、検証した単一HTMLだけがPagesに公開されます。公開後に実URLで開始・保存再開・共有URLを確認します。

新しいPushやPull Requestでは公開しません。必要ならGitHubの `github-pages` environmentに承認者を指定して、手動実行に加え公開直前のレビューも必須にできます。

この環境ではGitHubへのGit操作はできますが、GitHub APIへのアクセスが拒否されています。Pagesの有効化や実行ボタンの操作をこちらから完了できない場合は、所有者が上記画面で操作する必要があります。アカウントのパスワードをチャットに送らないでください。
