"use client";
import { FetchStore, open } from "zarrita";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


const s3 = new S3Client({
  region: "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});



const expirationInSeconds = 3600; // URL expiry time in seconds (1 hour)

async function generateSignedUrl() {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: process.env.AWS_OBJECT_KEY,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: expirationInSeconds,
    });

    console.log("Signed URL:", signedUrl);
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
  }
}

export default function Home() {
  const fetchZarr = async () => {
    try {
      const url = await generateSignedUrl();
      console.log('this is the url', url);
      const sstStore = new FetchStore(url ? url : "http://localhost:8080/output.zarr/sst");
      const sstArray = await open(sstStore, { kind: "array" });
      console.log('this is sstArray', sstArray);

      //this is equivalent to the dimensions in netcdf (but notice that a depth layer has been added here which was not present in .nc)
      const [timeLen, depthLen, latLen, lonLen] = sstArray.shape;

      //get the chunks that data is compressed into
      const chunks = sstArray.chunks;

      const [, , latChunkSize, lonChunkSize] = chunks;

      // reference date calucation, I'm not sure why it's done in mapbuilder 

      // const timeStore = new FetchStore(
      //   "http://localhost:8080/output.zarr/time"
      // );
      // const timeArray = await open(timeStore, { kind: "array" });
      // const timeData = await get(timeArray);
      // const time = timeData.data as Float32Array;
      // console.log("this is time", time[0] * 24 * 60 * 60 * 1000);
      // const latestDate = new Date(time[0] * 24 * 60 * 60 * 1000);
      // console.log("Latest date:", latestDate.toISOString());

      //end of ref date calc




      const validData = [];
      //map through each chunk, then inside each chunk map through all data, add data to validData array if meets conditions
      for (let latChunk = 0; latChunk < latLen / latChunkSize; latChunk++) {
        for (let lonChunk = 0; lonChunk < lonLen / lonChunkSize; lonChunk++) {

          console.log('working on chunk', latChunk, lonChunk)

          const chunk = await sstArray.getChunk([timeLen - 1, depthLen - 1, latChunk, lonChunk]);
          const data = chunk.data as Int16Array;
          for (let i = 0; i < data.length; i++) {
            const value = data[i];
            if (value !== -999 && value > -3 && value < 45) {
              validData.push(value);
            }
          }
        }
      }

      //consolidate values
      if(validData.length > 0) {
        const sum = validData.reduce((sum, index) => sum + index, 0);
        const meanValue = sum / validData.length;
        console.log('this ismean', meanValue);
        return meanValue;
      } else {
        console.log('error: no valid data')
      }
    } catch (error) {
      console.error("Error fetching Zarr data:", error);
      return null;
    }
  };

  return (
    <div>
      <button onClick={fetchZarr}>Fuck with Zarr</button>

    </div>
  );
}
