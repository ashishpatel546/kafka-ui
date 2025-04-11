import { useForm, SubmitHandler } from 'react-hook-form';
import { MessageSearchParams } from '@/types/kafka';

interface MessageSearchFormProps {
  selectedTopic: string;
  partitions: number[];
  initialValues: MessageSearchParams;
  onSearch: (params: MessageSearchParams) => void;
}

export default function MessageSearchForm({ 
  selectedTopic,
  partitions,
  initialValues,
  onSearch
}: MessageSearchFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<MessageSearchParams>({
    defaultValues: initialValues
  });

  const onSubmit: SubmitHandler<MessageSearchParams> = (data) => {
    onSearch({
      ...data,
      topic: selectedTopic,
      limit: Number(data.limit) || 100
    });
  };

  return (
    <div className="bg-white p-4 shadow rounded-lg mb-6">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Text
          </label>
          <input
            {...register('search')}
            placeholder="Filter messages containing text..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Partition
          </label>
          <select
            {...register('partition')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Partitions</option>
            {partitions.map((partition) => (
              <option key={partition} value={partition}>{partition}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Messages
          </label>
          <input
            {...register('limit', { 
              min: { value: 1, message: 'Minimum 1' },
              max: { value: 1000, message: 'Maximum 1000' }
            })}
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.limit && (
            <p className="text-red-500 text-sm mt-1">{errors.limit.message}</p>
          )}
        </div>
        
        <div className="flex items-end">
          <label className="flex items-center">
            <input
              {...register('fromBeginning')}
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Read from beginning (oldest messages first)
            </span>
          </label>
        </div>
        
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Search Messages
          </button>
        </div>
      </form>
    </div>
  );
}
