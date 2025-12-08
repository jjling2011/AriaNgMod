##### 合并上游更新
```bash
# 添加 upstream
git remote add upstream https://github.com/mayswind/AriaNg.git
git fetch upstream

# 创建新分支
git checkout -b m
git merge upstream/master

# 处理冲突后
git checkout master
git merge m
```

#### 编译

```bash
# 安装依赖
npm install

# 本地测试 build and serve
npm run bns

# 发布 demo
# 复制 dist 到 pages 目录
npm run sync
git commit -am "..."
# set proxy as need
# 提交到 GitHub
npm run pages

# 生成 all-in-one 发布文件
npm run allinone
```
