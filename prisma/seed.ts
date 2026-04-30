import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brandProfile.upsert({
    where: { id: "demo-brand" },
    update: {},
    create: {
      id: "demo-brand",
      name: "PawCare 鲜护",
      tone: "真诚、专业、温暖，不夸大功效",
      audience: "养猫养狗的新手与精细化喂养用户",
      forbiddenWords: JSON.stringify(["根治", "保证治愈", "绝对安全"]),
      servicePolicy: "先安抚情绪，再确认订单与宠物状态；涉及健康问题时建议咨询兽医。",
      replyLength: "medium"
    }
  });

  const batch = await prisma.importBatch.create({
    data: {
      fileName: "demo-pet-reviews.csv",
      totalRows: 6,
      reviews: {
        create: [
          {
            platform: "天猫",
            productName: "低敏鸡肉猫粮",
            rating: 5,
            author: "布偶家长",
            content: "猫咪换粮一周没有软便，颗粒大小也合适，客服提醒循序换粮很贴心。",
            createdAt: new Date("2026-03-21")
          },
          {
            platform: "京东",
            productName: "幼犬益生菌",
            rating: 2,
            author: "豆豆妈",
            content: "包装破了，粉末漏出来一半，狗狗还没敢吃，希望尽快处理。",
            createdAt: new Date("2026-03-24")
          },
          {
            platform: "小红书",
            productName: "猫砂除臭喷雾",
            rating: 3,
            author: "三花观察员",
            content: "味道不刺鼻，但除臭持续时间比预期短，大概半天就要再喷。",
            createdAt: new Date("2026-03-28")
          },
          {
            platform: "抖音小店",
            productName: "冻干零食",
            rating: 1,
            author: "柯基乐乐",
            content: "狗狗吃完吐了两次，不确定是不是零食问题，想问问成分和售后。",
            createdAt: new Date("2026-04-01")
          },
          {
            platform: "天猫",
            productName: "低敏鸡肉猫粮",
            rating: 4,
            author: "橘猫铲屎官",
            content: "猫爱吃，便便正常，希望能出更小包装方便试吃。",
            createdAt: new Date("2026-04-04")
          },
          {
            platform: "京东",
            productName: "宠物湿巾",
            rating: 5,
            author: "奶茶爸爸",
            content: "湿度刚好，擦脚不掉毛絮，出门回来用很方便。",
            createdAt: new Date("2026-04-05")
          }
        ]
      }
    }
  });

  await Promise.all(
    [
      {
        name: "review-analysis",
        version: "v1",
        purpose: "Analyze pet brand customer review into sentiment, topics, intent, urgency and summary.",
        content: "Return strict JSON only. Avoid unsupported factual claims.",
        active: true
      },
      {
        name: "reply-generation",
        version: "v1",
        purpose: "Generate customer-service reply draft for manual review.",
        content: "Use brand voice, avoid medical diagnosis, and flag risky promises.",
        active: true
      }
    ].map((prompt) =>
      prisma.promptVersion.upsert({
        where: { name_version: { name: prompt.name, version: prompt.version } },
        update: {},
        create: prompt
      })
    )
  );

  console.log(`Seeded ${brand.name} with batch ${batch.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
