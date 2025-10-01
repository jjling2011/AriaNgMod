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
pnpm install

# 编译
pnpm run build

# 本地测试
pnpm run serve

# 生成 all-in-one 发布文件
pnpm run allinone
```
