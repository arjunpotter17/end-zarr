"use client";
import { FetchStore, get, open } from "zarrita";

export default function Home() {
  const fetchZarr = async () => {
    try {
      const sstStore = new FetchStore("http://localhost:8080/output.zarr/sst");
      const sstArray = await open(sstStore, { kind: "array" });

      //this is equivalent to the dimensions in netcdf
      const [timeLen, depthLen, latLen, lonLen] = sstArray.shape;

      //get the chunks that data is comprssed into
      const chunks = sstArray.chunks;

      const [, depthChunks, latChunks, lonChunks] = chunks;

      const minLat = 142;
      const maxLat = latLen - 142;
      const minLon = 1;
      const maxLon = lonLen - 1;

      //check if time is within bounds to push to db, not used for now
      const timeStore = new FetchStore(
        "http://localhost:8080/output.zarr/time"
      );
      const timeArray = await open(timeStore, { kind: "array" });
      const timeData = await get(timeArray);
      const time = timeData.data as Float32Array;
      console.log("this is time", time[0] * 24 * 60 * 60 * 1000);
      const latestDate = new Date(time[0] * 24 * 60 * 60 * 1000);
      console.log("Latest date:", latestDate.toISOString());


      //this part is sketchy and needs work and testing
      const validData = [];
      for (let i = minLat; i < maxLat; i++) {
        for (let j = minLon; j < maxLon; j++) {
          const lat_chunk_idx = i / 180;
          const long_chunk_idx = j / 720;

          const chunk = await sstArray.getChunk([
            0,
            0,
            lat_chunk_idx,
            long_chunk_idx,
          ]);

          const time_offset = timeLen - 1;

          const depth_offset = depthLen - 1;

          const lat_offset = i % latChunks;

          const lon_offset = j % lonChunks;

          const index =
            time_offset * depthChunks * latChunks * lonChunks +
            depth_offset * latChunks * lonChunks +
            lat_offset * lonChunks +
            lon_offset;

          const data = chunk.data as Int16Array;
          const value = data[index];

          console.log("this is value", value);
          validData.push(value);
        }
      }
      const validChunks = await sstArray.getChunk([0, 0, 0, 0]);
      console.log("this is validChunks", validChunks);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataForChunk = validChunks.data as any;
      console.log("this is data for chunk", dataForChunk);
      console.log("this is data", dataForChunk[102290]);
    } catch (error) {
      console.error("Error fetching Zarr data:", error);
    }
  };

  return (
    <div>
      <button onClick={fetchZarr}>Fuck with Zarr</button>
    </div>
  );
}
