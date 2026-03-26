import vision from "@google-cloud/vision";

async function main() {
  const client = new vision.ImageAnnotatorClient();

  const [result] = await client.webDetection("/Users/etiennetabchoury/Downloads/nike.jpeg");

  console.log(JSON.stringify(result.webDetection, null, 2));
}

main().catch((err) => {
  console.error("Google Vision test failed:");
  console.error(err);
  process.exit(1);
});