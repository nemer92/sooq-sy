
export async function addSooqWatermark(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("الملف المحدد ليس صورة صالحة.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("تعذرت معالجة الصورة.");
    }

    context.drawImage(bitmap, 0, 0);

    const minDimension = Math.min(canvas.width, canvas.height);
    const fontSize = Math.max(14, Math.round(minDimension * 0.045));
    const paddingX = Math.round(fontSize * 0.75);
    const paddingY = Math.round(fontSize * 0.5);
    const margin = Math.max(12, Math.round(fontSize * 0.7));

    context.font = `bold ${fontSize}px Arial, sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "middle";

    const text = "Sooq.sy";
    const textWidth = context.measureText(text).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2;

    const x = canvas.width - boxWidth - margin;
    const y = canvas.height - boxHeight - margin;
    const radius = Math.round(boxHeight * 0.25);

    // خلفية داكنة شفافة خلف العلامة
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + boxWidth - radius, y);
    context.quadraticCurveTo(
      x + boxWidth,
      y,
      x + boxWidth,
      y + radius
    );
    context.lineTo(x + boxWidth, y + boxHeight - radius);
    context.quadraticCurveTo(
      x + boxWidth,
      y + boxHeight,
      x + boxWidth - radius,
      y + boxHeight
    );
    context.lineTo(x + radius, y + boxHeight);
    context.quadraticCurveTo(
      x,
      y + boxHeight,
      x,
      y + boxHeight - radius
    );
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();

    // كتابة العلامة المائية
    context.fillStyle = "#ffffff";
    context.fillText(
      text,
      x + paddingX,
      y + boxHeight / 2
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("تعذر حفظ الصورة بعد إضافة العلامة المائية."));
        },
        "image/jpeg",
        0.92
      );
    });

    const outputName = `${file.name.replace(/\.[^/.]+$/, "")}-sooqsy.jpg`;

    return new File([blob], outputName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
