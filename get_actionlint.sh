ACTIONLINT_VERSION=$(curl -fsSL https://api.github.com/repos/rhysd/actionlint/releases/latest | jq -r '.tag_name')
echo "https://github.com/rhysd/actionlint/releases/download/${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION#v}_linux_amd64.tar.gz"
