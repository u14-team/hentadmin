export default function initApi(api) {
  api.group('other')
    .method('methods', ctx => ctx.answer([...api.methods.keys()]));
}